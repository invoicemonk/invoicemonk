
-- =============================================
-- Year 3 Compliance: Automation, Artifacts, Analytics
-- =============================================

-- 1. Extend rule_type CHECK to include new types
ALTER TABLE public.compliance_validation_rules
  DROP CONSTRAINT compliance_validation_rules_rule_type_check;

ALTER TABLE public.compliance_validation_rules
  ADD CONSTRAINT compliance_validation_rules_rule_type_check
  CHECK (rule_type = ANY (ARRAY[
    'required_field', 'tax_id_format', 'vat_required', 'tax_rate_check',
    'tax_rate_mismatch', 'reverse_charge', 'exempt_category'
  ]));

-- 2. Create compliance_artifacts table
CREATE TABLE public.compliance_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  artifact_type TEXT NOT NULL,
  artifact_data JSONB NOT NULL,
  artifact_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

ALTER TABLE public.compliance_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view artifacts"
  ON public.compliance_artifacts FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage artifacts"
  ON public.compliance_artifacts FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated users can insert artifacts"
  ON public.compliance_artifacts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

-- Immutability trigger for compliance_artifacts
CREATE OR REPLACE FUNCTION public.prevent_artifact_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Compliance artifacts are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$;

CREATE TRIGGER prevent_artifact_modification
  BEFORE UPDATE OR DELETE ON public.compliance_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_artifact_modification();

-- Index for artifact lookups
CREATE INDEX idx_compliance_artifacts_invoice ON public.compliance_artifacts(invoice_id);
CREATE INDEX idx_compliance_artifacts_business ON public.compliance_artifacts(business_id);

-- 3. Create business_compliance_analytics table
CREATE TABLE public.business_compliance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) UNIQUE,
  period TEXT NOT NULL DEFAULT 'all_time',
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  total_invoices INT NOT NULL DEFAULT 0,
  blocked_count INT NOT NULL DEFAULT 0,
  warning_count INT NOT NULL DEFAULT 0,
  artifact_count INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_compliance_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view analytics"
  ON public.business_compliance_analytics FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage analytics"
  ON public.business_compliance_analytics FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- 4. Create update_compliance_analytics function
CREATE OR REPLACE FUNCTION public.update_compliance_analytics(
  p_business_id UUID,
  p_compliance_result JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _score NUMERIC;
  _warning_count INT := 0;
  _blocked_count_inc INT := 0;
  _check JSONB;
BEGIN
  _score := COALESCE((p_compliance_result->>'score')::numeric, 100);
  
  -- Count warnings and blocks from checks
  FOR _check IN SELECT jsonb_array_elements(COALESCE(p_compliance_result->'checks', '[]'::jsonb))
  LOOP
    IF (_check->>'passed')::boolean = false THEN
      IF _check->>'severity' = 'block' THEN
        _blocked_count_inc := _blocked_count_inc + 1;
      ELSE
        _warning_count := _warning_count + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO business_compliance_analytics (
    business_id, avg_score, total_invoices, blocked_count, warning_count, last_updated
  ) VALUES (
    p_business_id, _score, 1, _blocked_count_inc, _warning_count, now()
  )
  ON CONFLICT (business_id) DO UPDATE SET
    avg_score = (
      (business_compliance_analytics.avg_score * business_compliance_analytics.total_invoices + _score) 
      / (business_compliance_analytics.total_invoices + 1)
    ),
    total_invoices = business_compliance_analytics.total_invoices + 1,
    blocked_count = business_compliance_analytics.blocked_count + _blocked_count_inc,
    warning_count = business_compliance_analytics.warning_count + _warning_count,
    last_updated = now();
END;
$$;

-- 5. Update issue_invoice to auto-select tax schema and update analytics
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
 RETURNS SETOF invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _business businesses%ROWTYPE;
  _client clients%ROWTYPE;
  _retention_years INTEGER;
  _tax_schema tax_schemas%ROWTYPE;
  _hash_input TEXT;
  _invoice_hash TEXT;
  _pm_snapshot JSONB;
  _compliance JSONB;
  _compliance_hash TEXT;
  _auto_schema_id UUID;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;

  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;

  SELECT * INTO _business FROM businesses WHERE id = _invoice.business_id;
  SELECT * INTO _client FROM clients WHERE id = _invoice.client_id;

  -- AUTO-SELECT TAX SCHEMA if not set
  IF _invoice.tax_schema_id IS NULL AND _business.jurisdiction IS NOT NULL THEN
    SELECT id INTO _auto_schema_id
    FROM tax_schemas
    WHERE jurisdiction = _business.jurisdiction
      AND is_active = true
      AND effective_from <= CURRENT_DATE
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    ORDER BY effective_from DESC
    LIMIT 1;
    
    IF _auto_schema_id IS NOT NULL THEN
      UPDATE invoices SET tax_schema_id = _auto_schema_id WHERE id = _invoice_id;
      _invoice.tax_schema_id := _auto_schema_id;
    END IF;
  END IF;

  -- Run compliance validation (will raise exception on blocking failures)
  _compliance := validate_compliance(_invoice_id);

  -- Compute deterministic compliance hash
  _compliance_hash := encode(
    extensions.digest(canonicalize_jsonb(_compliance)::bytea, 'sha256'),
    'hex'
  );

  SELECT retention_years INTO _retention_years
  FROM retention_policies
  WHERE jurisdiction = COALESCE(_business.jurisdiction, 'NG')
    AND entity_type = 'invoice'
  ORDER BY created_at DESC LIMIT 1;

  _retention_years := COALESCE(_retention_years, 7);

  IF _invoice.tax_schema_id IS NOT NULL THEN
    SELECT * INTO _tax_schema FROM tax_schemas WHERE id = _invoice.tax_schema_id;
  END IF;

  -- Snapshot payment method if set
  IF _invoice.payment_method_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'provider_type', pm.provider_type,
      'display_name', pm.display_name,
      'instructions', pm.instructions
    ) INTO _pm_snapshot
    FROM payment_methods pm
    WHERE pm.id = _invoice.payment_method_id;
  END IF;

  UPDATE invoices SET
    status = 'issued',
    issued_at = now(),
    issued_by = auth.uid(),
    issue_date = COALESCE(_invoice.issue_date, CURRENT_DATE),
    verification_id = COALESCE(_invoice.verification_id, gen_random_uuid()),
    retention_locked_until = (CURRENT_DATE + (_retention_years * INTERVAL '1 year'))::date,
    compliance_result = _compliance,
    compliance_hash = _compliance_hash,
    issuer_snapshot = jsonb_build_object(
      'business_name', _business.name,
      'legal_name', _business.legal_name,
      'tax_id', _business.tax_id,
      'cac_number', _business.cac_number,
      'vat_registration_number', _business.vat_registration_number,
      'contact_email', _business.contact_email,
      'contact_phone', _business.contact_phone,
      'address', _business.address,
      'logo_url', _business.logo_url,
      'jurisdiction', _business.jurisdiction,
      'is_vat_registered', COALESCE(_business.is_vat_registered, false)
    ),
    recipient_snapshot = jsonb_build_object(
      'name', _client.name,
      'email', _client.email,
      'phone', _client.phone,
      'address', _client.address,
      'contact_person', _client.contact_person,
      'tax_id', _client.tax_id,
      'cac_number', _client.cac_number
    ),
    tax_schema_snapshot = CASE
      WHEN _tax_schema.id IS NOT NULL THEN jsonb_build_object(
        'name', _tax_schema.name,
        'version', _tax_schema.version,
        'jurisdiction', _tax_schema.jurisdiction,
        'rates', _tax_schema.rates,
        'rules', _tax_schema.rules
      )
      ELSE _invoice.tax_schema_snapshot
    END,
    tax_schema_version = COALESCE(_tax_schema.version, _invoice.tax_schema_version),
    payment_method_snapshot = _pm_snapshot
  WHERE id = _invoice_id;

  -- Generate financial hash
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;

  _hash_input := _invoice.id::text || _invoice.invoice_number || _invoice.total_amount::text ||
    _invoice.issued_at::text || COALESCE(_invoice.verification_id::text, '');

  _invoice_hash := encode(extensions.digest(_hash_input::bytea, 'sha256'), 'hex');

  UPDATE invoices SET invoice_hash = _invoice_hash WHERE id = _invoice_id;

  -- Update compliance analytics
  PERFORM update_compliance_analytics(_invoice.business_id, _compliance);

  -- Log audit event
  PERFORM log_audit_event(
    _event_type := 'INVOICE_ISSUED',
    _entity_type := 'invoice',
    _entity_id := _invoice_id,
    _user_id := auth.uid(),
    _business_id := _invoice.business_id,
    _new_state := jsonb_build_object(
      'status', 'issued',
      'invoice_number', _invoice.invoice_number,
      'total_amount', _invoice.total_amount,
      'compliance_score', (_compliance->>'score')::integer
    )
  );

  -- Notify admin on first invoice
  IF (SELECT COUNT(*) FROM invoices WHERE business_id = _invoice.business_id AND status != 'draft') = 1 THEN
    PERFORM notify_admin_first_invoice_issued(_invoice.business_id, _invoice_id, _invoice.invoice_number);
  END IF;

  RETURN QUERY SELECT * FROM invoices WHERE id = _invoice_id;
END;
$$;

-- 6. Update validate_compliance to handle new rule types
CREATE OR REPLACE FUNCTION public.validate_compliance(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _business businesses%ROWTYPE;
  _client clients%ROWTYPE;
  _jurisdiction TEXT;
  _tax_schema tax_schemas%ROWTYPE;
  _rule RECORD;
  _rules_found BOOLEAN := false;
  _checks JSONB := '[]'::jsonb;
  _score INTEGER := 100;
  _has_blocker BOOLEAN := false;
  _field_value TEXT;
  _entity_table TEXT;
  _col_exists BOOLEAN;
  _require_rules BOOLEAN;
  _check_entry JSONB;
  _field_name TEXT;
  _allowed_business_fields TEXT[] := ARRAY['tax_id', 'cac_number', 'name', 'legal_name', 'jurisdiction', 'contact_email', 'contact_phone', 'vat_registration_number', 'business_type', 'registration_status', 'compliance_status', 'regulator_code'];
  _allowed_client_fields TEXT[] := ARRAY['name', 'email', 'phone', 'tax_id', 'cac_number', 'client_type', 'contact_person'];
  _allowed_invoice_fields TEXT[] := ARRAY['invoice_number', 'currency', 'due_date', 'issue_date', 'notes', 'terms', 'summary'];
BEGIN
  -- 1. Strict entity loading
  SELECT * INTO _invoice FROM invoices WHERE id = p_invoice_id;
  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Compliance validation failed: Invoice not found (id: %)', p_invoice_id;
  END IF;

  SELECT * INTO _business FROM businesses WHERE id = _invoice.business_id;
  IF _business IS NULL THEN
    RAISE EXCEPTION 'Compliance validation failed: Business not found (id: %)', _invoice.business_id;
  END IF;

  SELECT * INTO _client FROM clients WHERE id = _invoice.client_id;
  IF _client IS NULL THEN
    RAISE EXCEPTION 'Compliance validation failed: Client not found (id: %)', _invoice.client_id;
  END IF;

  -- 2. Resolve jurisdiction (fail closed)
  IF _invoice.tax_schema_id IS NOT NULL THEN
    SELECT * INTO _tax_schema FROM tax_schemas WHERE id = _invoice.tax_schema_id;
    _jurisdiction := _tax_schema.jurisdiction;
  END IF;

  IF _jurisdiction IS NULL OR _jurisdiction = '' THEN
    _jurisdiction := _business.jurisdiction;
  END IF;

  IF _jurisdiction IS NULL OR _jurisdiction = '' THEN
    RAISE EXCEPTION 'Cannot issue invoice: jurisdiction could not be determined for business "%" (id: %)', _business.name, _business.id;
  END IF;

  -- 3. Load active rules
  FOR _rule IN
    SELECT r.rule_key, r.rule_type, r.rule_definition, r.severity
    FROM compliance_validation_rules r
    WHERE r.jurisdiction = _jurisdiction AND r.is_active = true
    ORDER BY r.rule_key
  LOOP
    _rules_found := true;

    -- Field reference validation (for field-based rules)
    IF _rule.rule_definition ? 'entity' AND _rule.rule_definition ? 'field' THEN
      _field_name := _rule.rule_definition->>'field';
      _entity_table := CASE (_rule.rule_definition->>'entity')
        WHEN 'business' THEN 'businesses'
        WHEN 'client' THEN 'clients'
        WHEN 'invoice' THEN 'invoices'
        ELSE NULL
      END;

      IF _entity_table IS NOT NULL AND _field_name IS NOT NULL THEN
        IF _entity_table = 'businesses' AND NOT (_field_name = ANY(_allowed_business_fields)) THEN
          RAISE EXCEPTION 'Compliance rule configuration error: field "%" is not in the allowed fields for table "businesses" (rule: %)', _field_name, _rule.rule_key;
        ELSIF _entity_table = 'clients' AND NOT (_field_name = ANY(_allowed_client_fields)) THEN
          RAISE EXCEPTION 'Compliance rule configuration error: field "%" is not in the allowed fields for table "clients" (rule: %)', _field_name, _rule.rule_key;
        ELSIF _entity_table = 'invoices' AND NOT (_field_name = ANY(_allowed_invoice_fields)) THEN
          RAISE EXCEPTION 'Compliance rule configuration error: field "%" is not in the allowed fields for table "invoices" (rule: %)', _field_name, _rule.rule_key;
        END IF;
      END IF;

      IF _entity_table IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = _entity_table
            AND column_name = _field_name
        ) INTO _col_exists;

        IF NOT _col_exists THEN
          RAISE EXCEPTION 'Compliance rule configuration error: field "%" does not exist on table "%" (rule: %)',
            _field_name, _entity_table, _rule.rule_key;
        END IF;
      END IF;
    END IF;

    -- Evaluate rules by type
    CASE _rule.rule_type
      WHEN 'required_field' THEN
        CASE (_rule.rule_definition->>'entity')
          WHEN 'business' THEN
            EXECUTE format('SELECT ($1).%I::text', _rule.rule_definition->>'field') INTO _field_value USING _business;
          WHEN 'client' THEN
            EXECUTE format('SELECT ($1).%I::text', _rule.rule_definition->>'field') INTO _field_value USING _client;
          WHEN 'invoice' THEN
            EXECUTE format('SELECT ($1).%I::text', _rule.rule_definition->>'field') INTO _field_value USING _invoice;
          ELSE
            _field_value := NULL;
        END CASE;

        IF _field_value IS NULL OR trim(_field_value) = '' THEN
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', false,
            'message', COALESCE(_rule.rule_definition->>'message', 'Required field is missing')
          );
          IF _rule.severity = 'block' THEN
            _has_blocker := true;
            _score := _score - 25;
          ELSE
            _score := _score - 10;
          END IF;
        ELSE
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', true,
            'message', 'OK'
          );
        END IF;
        _checks := _checks || _check_entry;

      WHEN 'tax_id_format' THEN
        CASE (_rule.rule_definition->>'entity')
          WHEN 'business' THEN
            EXECUTE format('SELECT ($1).%I::text', _rule.rule_definition->>'field') INTO _field_value USING _business;
          WHEN 'client' THEN
            EXECUTE format('SELECT ($1).%I::text', _rule.rule_definition->>'field') INTO _field_value USING _client;
          ELSE
            _field_value := NULL;
        END CASE;

        IF _field_value IS NOT NULL AND trim(_field_value) != '' THEN
          IF _field_value !~ (_rule.rule_definition->>'regex') THEN
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', false,
              'message', COALESCE(_rule.rule_definition->>'message', 'Tax ID format mismatch')
            );
            IF _rule.severity = 'block' THEN
              _has_blocker := true;
              _score := _score - 25;
            ELSE
              _score := _score - 10;
            END IF;
          ELSE
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', true,
              'message', 'OK'
            );
          END IF;
        ELSE
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', true,
            'message', 'Skipped (field empty)'
          );
        END IF;
        _checks := _checks || _check_entry;

      WHEN 'vat_required' THEN
        IF COALESCE(_business.is_vat_registered, false) THEN
          IF _business.vat_registration_number IS NULL OR trim(_business.vat_registration_number) = '' THEN
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', false,
              'message', COALESCE(_rule.rule_definition->>'message', 'VAT registration number required')
            );
            IF _rule.severity = 'block' THEN
              _has_blocker := true;
              _score := _score - 25;
            ELSE
              _score := _score - 10;
            END IF;
          ELSE
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', true,
              'message', 'OK'
            );
          END IF;
        ELSE
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', true,
            'message', 'Skipped (not VAT registered)'
          );
        END IF;
        _checks := _checks || _check_entry;

      WHEN 'tax_rate_check' THEN
        IF _tax_schema.id IS NOT NULL AND _tax_schema.rates IS NOT NULL THEN
          DECLARE
            _item RECORD;
            _valid_rates JSONB := _tax_schema.rates;
            _rate_valid BOOLEAN;
          BEGIN
            FOR _item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
            LOOP
              _rate_valid := false;
              IF _item.tax_rate = 0 THEN
                _rate_valid := true;
              ELSE
                SELECT EXISTS(
                  SELECT 1 FROM jsonb_array_elements(_valid_rates) r
                  WHERE (r->>'rate')::numeric = _item.tax_rate
                ) INTO _rate_valid;
              END IF;

              IF NOT _rate_valid THEN
                _check_entry := jsonb_build_object(
                  'rule_key', _rule.rule_key || '_item_' || _item.id,
                  'rule_type', _rule.rule_type,
                  'severity', _rule.severity,
                  'passed', false,
                  'message', format('Tax rate %s%% on item "%s" is not in the approved rates for this tax schema',
                    _item.tax_rate, left(_item.description, 50))
                );
                IF _rule.severity = 'block' THEN
                  _has_blocker := true;
                  _score := _score - 25;
                ELSE
                  _score := _score - 5;
                END IF;
                _checks := _checks || _check_entry;
              END IF;
            END LOOP;

            IF NOT _has_blocker THEN
              _check_entry := jsonb_build_object(
                'rule_key', _rule.rule_key,
                'rule_type', _rule.rule_type,
                'severity', _rule.severity,
                'passed', true,
                'message', 'All tax rates valid'
              );
              _checks := _checks || _check_entry;
            END IF;
          END;
        ELSE
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', true,
            'message', 'Skipped (no tax schema)'
          );
          _checks := _checks || _check_entry;
        END IF;

      -- NEW: tax_rate_mismatch - compares line items against schema default rate
      WHEN 'tax_rate_mismatch' THEN
        IF _tax_schema.id IS NOT NULL AND _tax_schema.rates IS NOT NULL THEN
          DECLARE
            _item RECORD;
            _default_rate NUMERIC;
            _mismatch_found BOOLEAN := false;
          BEGIN
            -- Get the default/first rate from the schema
            SELECT (r->>'rate')::numeric INTO _default_rate
            FROM jsonb_array_elements(_tax_schema.rates) r
            LIMIT 1;

            IF _default_rate IS NOT NULL THEN
              FOR _item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
              LOOP
                IF _item.tax_rate != 0 AND _item.tax_rate != _default_rate THEN
                  _mismatch_found := true;
                  _check_entry := jsonb_build_object(
                    'rule_key', _rule.rule_key || '_item_' || _item.id,
                    'rule_type', _rule.rule_type,
                    'severity', _rule.severity,
                    'passed', false,
                    'message', format('Tax rate %s%% on "%s" differs from jurisdiction default %s%%',
                      _item.tax_rate, left(_item.description, 50), _default_rate)
                  );
                  _score := _score - 5;
                  _checks := _checks || _check_entry;
                END IF;
              END LOOP;
            END IF;

            IF NOT _mismatch_found THEN
              _check_entry := jsonb_build_object(
                'rule_key', _rule.rule_key,
                'rule_type', _rule.rule_type,
                'severity', _rule.severity,
                'passed', true,
                'message', 'All line item tax rates match jurisdiction default'
              );
              _checks := _checks || _check_entry;
            END IF;
          END;
        ELSE
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', true,
            'message', 'Skipped (no tax schema)'
          );
          _checks := _checks || _check_entry;
        END IF;

      -- NEW: reverse_charge - cross-border B2B check
      WHEN 'reverse_charge' THEN
        DECLARE
          _client_jurisdiction TEXT;
        BEGIN
          -- Determine client jurisdiction from address or tax_id patterns
          _client_jurisdiction := NULL;
          IF _client.address IS NOT NULL AND (_client.address->>'country') IS NOT NULL THEN
            _client_jurisdiction := _client.address->>'country';
          END IF;

          IF _client_jurisdiction IS NOT NULL AND _client_jurisdiction != _business.jurisdiction THEN
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', false,
              'message', format('Cross-border invoice: business jurisdiction "%s" differs from client jurisdiction "%s". Reverse charge may apply.',
                _business.jurisdiction, _client_jurisdiction)
            );
            _score := _score - 5;
          ELSE
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', true,
              'message', 'Same jurisdiction or client jurisdiction unknown'
            );
          END IF;
          _checks := _checks || _check_entry;
        END;

      -- NEW: exempt_category - skip tax validation for exempt items
      WHEN 'exempt_category' THEN
        DECLARE
          _item RECORD;
          _exempt_categories TEXT[];
          _exempt_found BOOLEAN := false;
        BEGIN
          _exempt_categories := ARRAY(
            SELECT jsonb_array_elements_text(
              COALESCE(_rule.rule_definition->'exempt_categories', '[]'::jsonb)
            )
          );

          FOR _item IN 
            SELECT ii.*, ps.category 
            FROM invoice_items ii
            LEFT JOIN products_services ps ON ps.id = ii.product_service_id
            WHERE ii.invoice_id = p_invoice_id
          LOOP
            IF _item.category IS NOT NULL AND _item.category = ANY(_exempt_categories) THEN
              _exempt_found := true;
              _check_entry := jsonb_build_object(
                'rule_key', _rule.rule_key || '_item_' || _item.id,
                'rule_type', _rule.rule_type,
                'severity', 'warn',
                'passed', true,
                'message', format('Item "%s" (category: %s) is tax-exempt per jurisdiction rules',
                  left(_item.description, 50), _item.category)
              );
              _checks := _checks || _check_entry;
            END IF;
          END LOOP;

          IF NOT _exempt_found THEN
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', true,
              'message', 'No exempt categories found'
            );
            _checks := _checks || _check_entry;
          END IF;
        END;

      ELSE
        _check_entry := jsonb_build_object(
          'rule_key', _rule.rule_key,
          'rule_type', _rule.rule_type,
          'severity', _rule.severity,
          'passed', true,
          'message', 'Unknown rule type, skipped'
        );
        _checks := _checks || _check_entry;
    END CASE;
  END LOOP;

  -- Policy-driven empty rules check
  IF NOT _rules_found THEN
    SELECT require_rules_for_jurisdiction INTO _require_rules
    FROM compliance_system_policy WHERE id = true;

    IF COALESCE(_require_rules, true) THEN
      RAISE EXCEPTION 'No active compliance rules configured for jurisdiction "%" . Issuance blocked by system policy.', _jurisdiction;
    ELSE
      _check_entry := jsonb_build_object(
        'rule_key', 'no_rules_warning',
        'rule_type', 'system',
        'severity', 'warn',
        'passed', true,
        'message', format('No active compliance rules configured for jurisdiction "%s". Proceeding per system policy.', _jurisdiction)
      );
      _checks := _checks || _check_entry;
      _score := _score - 15;
    END IF;
  END IF;

  -- Block if any blocker found
  IF _has_blocker THEN
    RAISE EXCEPTION 'Invoice compliance validation failed for jurisdiction "%". One or more blocking rules did not pass. Details: %',
      _jurisdiction, _checks::text;
  END IF;

  -- Clamp score
  IF _score < 0 THEN _score := 0; END IF;

  RETURN jsonb_build_object(
    'result', CASE WHEN _score >= 70 THEN 'pass' ELSE 'review' END,
    'score', _score,
    'jurisdiction', _jurisdiction,
    'checks', _checks,
    'validated_at', now()
  );
END;
$$;

-- 7. Seed new compliance rules
INSERT INTO compliance_validation_rules (jurisdiction, rule_key, rule_type, severity, rule_definition, is_active) VALUES
  ('NG', 'ng_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', '{"message": "Line item tax rate differs from Nigerian VAT standard rate"}', true),
  ('GB', 'gb_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', '{"message": "Line item tax rate differs from UK VAT standard rate"}', true),
  ('GB', 'gb_reverse_charge', 'reverse_charge', 'warn', '{"message": "Cross-border B2B service may require reverse charge mechanism"}', true);
