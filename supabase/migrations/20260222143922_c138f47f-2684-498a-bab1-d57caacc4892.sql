
-- ============================================================
-- Step 1: Add compliance columns to invoices
-- ============================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS compliance_result JSONB;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS compliance_hash TEXT;

-- ============================================================
-- Step 2: Create compliance_validation_rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compliance_validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction TEXT NOT NULL,
    rule_key TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('required_field', 'tax_id_format', 'vat_required', 'tax_rate_check')),
    rule_definition JSONB NOT NULL DEFAULT '{}',
    severity TEXT NOT NULL CHECK (severity IN ('block', 'warn')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cvr_jurisdiction_rule_key_unique UNIQUE (jurisdiction, rule_key)
);

ALTER TABLE public.compliance_validation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage compliance rules"
  ON public.compliance_validation_rules FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated users can view compliance rules"
  ON public.compliance_validation_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Step 3: Create compliance_system_policy table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compliance_system_policy (
    id BOOLEAN PRIMARY KEY DEFAULT true,
    require_rules_for_jurisdiction BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.compliance_system_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage compliance policy"
  ON public.compliance_system_policy FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated users can view compliance policy"
  ON public.compliance_system_policy FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed single row
INSERT INTO public.compliance_system_policy (id, require_rules_for_jurisdiction)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Step 4: Seed rules for NG and GB
-- ============================================================
INSERT INTO public.compliance_validation_rules (jurisdiction, rule_key, rule_type, rule_definition, severity) VALUES
  -- Nigeria (NG)
  ('NG', 'business_tax_id', 'required_field', '{"entity": "business", "field": "tax_id", "message": "Business must have a Tax Identification Number (TIN)"}', 'block'),
  ('NG', 'tin_format', 'tax_id_format', '{"entity": "business", "field": "tax_id", "regex": "^[0-9]{8}-[0-9]{4}$|^[0-9]{10,12}$", "message": "TIN should match Nigerian format (e.g., 12345678-0001 or 10-12 digits)"}', 'warn'),
  ('NG', 'client_name', 'required_field', '{"entity": "client", "field": "name", "message": "Client must have a name"}', 'block'),
  ('NG', 'due_date', 'required_field', '{"entity": "invoice", "field": "due_date", "message": "Invoice should have a due date"}', 'warn'),
  -- UK (GB)
  ('GB', 'vat_required', 'vat_required', '{"message": "VAT-registered businesses must have a VAT registration number"}', 'block'),
  ('GB', 'business_tax_id', 'required_field', '{"entity": "business", "field": "tax_id", "message": "Business should have a Unique Taxpayer Reference (UTR)"}', 'warn'),
  ('GB', 'client_email', 'required_field', '{"entity": "client", "field": "email", "message": "Client should have an email address"}', 'warn')
ON CONFLICT (jurisdiction, rule_key) DO NOTHING;

-- ============================================================
-- Step 5: Create canonicalize_jsonb helper function
-- ============================================================
CREATE OR REPLACE FUNCTION public.canonicalize_jsonb(p_input JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _result TEXT;
  _key TEXT;
  _val JSONB;
  _parts TEXT[] := '{}';
  _elem JSONB;
  _arr_parts TEXT[] := '{}';
BEGIN
  IF p_input IS NULL THEN
    RETURN 'null';
  END IF;

  CASE jsonb_typeof(p_input)
    WHEN 'object' THEN
      FOR _key, _val IN SELECT * FROM jsonb_each(p_input) ORDER BY key
      LOOP
        _parts := array_append(_parts, '"' || _key || '":' || canonicalize_jsonb(_val));
      END LOOP;
      RETURN '{' || array_to_string(_parts, ',') || '}';

    WHEN 'array' THEN
      FOR _elem IN SELECT * FROM jsonb_array_elements(p_input)
      LOOP
        _arr_parts := array_append(_arr_parts, canonicalize_jsonb(_elem));
      END LOOP;
      RETURN '[' || array_to_string(_arr_parts, ',') || ']';

    WHEN 'string' THEN
      RETURN p_input::text;

    WHEN 'number' THEN
      RETURN p_input::text;

    WHEN 'boolean' THEN
      RETURN p_input::text;

    WHEN 'null' THEN
      RETURN 'null';

    ELSE
      RETURN p_input::text;
  END CASE;
END;
$$;

-- ============================================================
-- Step 6: Create validate_compliance function
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_compliance(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 3. Load active rules, merge with tax_schema.rules if present
  FOR _rule IN
    SELECT r.rule_key, r.rule_type, r.rule_definition, r.severity
    FROM compliance_validation_rules r
    WHERE r.jurisdiction = _jurisdiction AND r.is_active = true
    ORDER BY r.rule_key
  LOOP
    _rules_found := true;

    -- 5. Field reference validation (for field-based rules)
    IF _rule.rule_definition ? 'entity' AND _rule.rule_definition ? 'field' THEN
      _entity_table := CASE (_rule.rule_definition->>'entity')
        WHEN 'business' THEN 'businesses'
        WHEN 'client' THEN 'clients'
        WHEN 'invoice' THEN 'invoices'
        ELSE NULL
      END;

      IF _entity_table IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = _entity_table
            AND column_name = (_rule.rule_definition->>'field')
        ) INTO _col_exists;

        IF NOT _col_exists THEN
          RAISE EXCEPTION 'Compliance rule configuration error: field "%" does not exist on table "%" (rule: %)',
            _rule.rule_definition->>'field', _entity_table, _rule.rule_key;
        END IF;
      END IF;
    END IF;

    -- 6. Evaluate rules by type
    CASE _rule.rule_type
      WHEN 'required_field' THEN
        -- Get value from the appropriate entity
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
          -- Field is empty; format check is N/A (required_field rule handles presence)
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
        -- Verify invoice item tax rates against tax_schema.rates
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
                  'message', format('Tax rate %s%% on item "%s" does not match configured rates', _item.tax_rate, _item.description)
                );
                _checks := _checks || _check_entry;
                IF _rule.severity = 'block' THEN
                  _has_blocker := true;
                  _score := _score - 15;
                ELSE
                  _score := _score - 5;
                END IF;
              END IF;
            END LOOP;

            IF NOT _has_blocker OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_checks) c WHERE c->>'rule_type' = 'tax_rate_check' AND (c->>'passed')::boolean = false) THEN
              _check_entry := jsonb_build_object(
                'rule_key', _rule.rule_key,
                'rule_type', _rule.rule_type,
                'severity', _rule.severity,
                'passed', true,
                'message', 'OK'
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
            'message', 'Skipped (no tax schema configured)'
          );
          _checks := _checks || _check_entry;
        END IF;

      ELSE
        RAISE EXCEPTION 'Unknown compliance rule type: %', _rule.rule_type;
    END CASE;
  END LOOP;

  -- 4. Policy-driven empty rules check
  IF NOT _rules_found THEN
    SELECT require_rules_for_jurisdiction INTO _require_rules
    FROM compliance_system_policy WHERE id = true;

    _require_rules := COALESCE(_require_rules, true);

    IF _require_rules THEN
      RAISE EXCEPTION 'No active compliance rules configured for jurisdiction "%" . Issuance blocked by system policy.', _jurisdiction;
    ELSE
      _check_entry := jsonb_build_object(
        'rule_key', 'no_rules_configured',
        'rule_type', 'system',
        'severity', 'warn',
        'passed', true,
        'message', format('No active compliance rules configured for jurisdiction "%s". Proceeding with warning.', _jurisdiction)
      );
      _checks := _checks || _check_entry;
      _score := _score - 20;
    END IF;
  END IF;

  -- Block if any blocker failed
  IF _has_blocker THEN
    RAISE EXCEPTION 'Invoice compliance validation failed for jurisdiction "%". Blocking issues: %',
      _jurisdiction,
      (SELECT string_agg(c->>'message', '; ')
       FROM jsonb_array_elements(_checks) c
       WHERE (c->>'passed')::boolean = false AND c->>'severity' = 'block');
  END IF;

  -- Clamp score
  IF _score < 0 THEN _score := 0; END IF;

  RETURN jsonb_build_object(
    'result', CASE WHEN _score >= 70 THEN 'pass' ELSE 'warn' END,
    'score', _score,
    'jurisdiction', _jurisdiction,
    'checks', _checks,
    'validated_at', now()
  );
END;
$$;

-- ============================================================
-- Step 7: Update prevent_invoice_modification trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_invoice_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow status transitions and payment updates
  IF OLD.status != 'draft' THEN
    -- Only allow specific field updates after issuance
    IF (
      OLD.invoice_number != NEW.invoice_number OR
      OLD.client_id != NEW.client_id OR
      OLD.subtotal != NEW.subtotal OR
      OLD.tax_amount != NEW.tax_amount OR
      OLD.discount_amount != NEW.discount_amount OR
      OLD.total_amount != NEW.total_amount OR
      OLD.currency != NEW.currency OR
      OLD.issue_date != NEW.issue_date OR
      OLD.issued_at != NEW.issued_at OR
      OLD.invoice_hash != NEW.invoice_hash OR
      -- Compliance and snapshot immutability (IS DISTINCT FROM for nullable fields)
      OLD.compliance_result IS DISTINCT FROM NEW.compliance_result OR
      OLD.compliance_hash IS DISTINCT FROM NEW.compliance_hash OR
      OLD.issuer_snapshot IS DISTINCT FROM NEW.issuer_snapshot OR
      OLD.recipient_snapshot IS DISTINCT FROM NEW.recipient_snapshot OR
      OLD.tax_schema_snapshot IS DISTINCT FROM NEW.tax_schema_snapshot OR
      OLD.verification_id IS DISTINCT FROM NEW.verification_id
    ) THEN
      RAISE EXCEPTION 'Cannot modify issued invoice. Financial and compliance data is immutable.';
    END IF;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Step 8: Update issue_invoice function
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id UUID)
RETURNS SETOF invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
