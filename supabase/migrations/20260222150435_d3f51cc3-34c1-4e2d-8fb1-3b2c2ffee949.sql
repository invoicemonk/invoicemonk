-- Add field allowlist to validate_compliance function to prevent dynamic SQL abuse
CREATE OR REPLACE FUNCTION public.validate_compliance(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      _field_name := _rule.rule_definition->>'field';
      _entity_table := CASE (_rule.rule_definition->>'entity')
        WHEN 'business' THEN 'businesses'
        WHEN 'client' THEN 'clients'
        WHEN 'invoice' THEN 'invoices'
        ELSE NULL
      END;

      -- Field allowlist validation: prevent access to sensitive/unexpected columns
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

  -- 4. Policy-driven empty rules check
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
$function$;