
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

  FOR _rule IN
    SELECT r.rule_key, r.rule_type, r.rule_definition, r.severity
    FROM compliance_validation_rules r
    WHERE r.jurisdiction = _jurisdiction AND r.is_active = true
    ORDER BY r.rule_key
  LOOP
    _rules_found := true;

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

    CASE _rule.rule_type
      WHEN 'required_field' THEN
        _field_value := CASE (_rule.rule_definition->>'entity')
          WHEN 'business' THEN
            CASE _field_name
              WHEN 'tax_id' THEN _business.tax_id
              WHEN 'cac_number' THEN _business.cac_number
              WHEN 'name' THEN _business.name
              WHEN 'legal_name' THEN _business.legal_name
              WHEN 'jurisdiction' THEN _business.jurisdiction
              WHEN 'contact_email' THEN _business.contact_email
              WHEN 'contact_phone' THEN _business.contact_phone
              WHEN 'vat_registration_number' THEN _business.vat_registration_number
              WHEN 'business_type' THEN _business.business_type
              WHEN 'registration_status' THEN _business.registration_status
              WHEN 'compliance_status' THEN _business.compliance_status
              WHEN 'regulator_code' THEN _business.regulator_code
              ELSE NULL
            END
          WHEN 'client' THEN
            CASE _field_name
              WHEN 'name' THEN _client.name
              WHEN 'email' THEN _client.email
              WHEN 'phone' THEN _client.phone
              WHEN 'tax_id' THEN _client.tax_id
              WHEN 'cac_number' THEN _client.cac_number
              WHEN 'client_type' THEN _client.client_type
              WHEN 'contact_person' THEN _client.contact_person
              ELSE NULL
            END
          WHEN 'invoice' THEN
            CASE _field_name
              WHEN 'invoice_number' THEN _invoice.invoice_number
              WHEN 'currency' THEN _invoice.currency
              WHEN 'due_date' THEN _invoice.due_date::text
              WHEN 'issue_date' THEN _invoice.issue_date::text
              WHEN 'notes' THEN _invoice.notes
              WHEN 'terms' THEN _invoice.terms
              WHEN 'summary' THEN _invoice.summary
              ELSE NULL
            END
          ELSE NULL
        END;

        IF _field_value IS NULL OR _field_value = '' THEN
          _check_entry := jsonb_build_object(
            'rule_key', _rule.rule_key,
            'rule_type', _rule.rule_type,
            'severity', _rule.severity,
            'passed', false,
            'message', COALESCE(
              _rule.rule_definition->>'message',
              format('%s.%s is required', _rule.rule_definition->>'entity', _field_name)
            )
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

      WHEN 'vat_registration_check' THEN
        IF _business.is_vat_registered = true THEN
          IF _business.vat_registration_number IS NULL OR _business.vat_registration_number = '' THEN
            _check_entry := jsonb_build_object(
              'rule_key', _rule.rule_key,
              'rule_type', _rule.rule_type,
              'severity', _rule.severity,
              'passed', false,
              'message', COALESCE(
                _rule.rule_definition->>'message',
                'Business is marked as VAT registered but VAT registration number is missing'
              )
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
                -- FIX: rates is a JSON object like {"vat": 7.5}, not an array
                SELECT EXISTS(
                  SELECT 1 FROM jsonb_each_text(_valid_rates) r(key, value)
                  WHERE r.value::numeric = _item.tax_rate
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

      WHEN 'tax_rate_mismatch' THEN
        IF _tax_schema.id IS NOT NULL AND _tax_schema.rates IS NOT NULL THEN
          DECLARE
            _item RECORD;
            _default_rate NUMERIC;
            _mismatch_found BOOLEAN := false;
          BEGIN
            -- FIX: rates is a JSON object like {"vat": 7.5}, get the first value
            SELECT r.value::numeric INTO _default_rate
            FROM jsonb_each_text(_tax_schema.rates) r(key, value)
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

      ELSE
        _check_entry := jsonb_build_object(
          'rule_key', _rule.rule_key,
          'rule_type', _rule.rule_type,
          'severity', 'warn',
          'passed', true,
          'message', format('Unknown rule type: %s (skipped)', _rule.rule_type)
        );
        _checks := _checks || _check_entry;
    END CASE;
  END LOOP;

  SELECT COALESCE(
    (SELECT require_rules_for_jurisdiction FROM compliance_system_policy WHERE id = true),
    true
  ) INTO _require_rules;

  IF NOT _rules_found THEN
    IF _require_rules THEN
      RAISE EXCEPTION 'Cannot issue invoice: no compliance rules configured for jurisdiction "%" — contact platform admin to configure rules or disable strict compliance mode', _jurisdiction;
    ELSE
      _checks := _checks || jsonb_build_object(
        'rule_key', 'no_rules',
        'rule_type', 'info',
        'severity', 'info',
        'passed', true,
        'message', format('No compliance rules found for jurisdiction "%s" — invoice allowed (non-strict mode)', _jurisdiction)
      );
    END IF;
  END IF;

  IF _score < 0 THEN _score := 0; END IF;

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'jurisdiction', _jurisdiction,
    'score', _score,
    'has_blocker', _has_blocker,
    'checks', _checks,
    'validated_at', now()
  );
END;
$function$;
