CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_business RECORD;
  v_client RECORD;
  v_items jsonb;
  v_hash_input text;
  v_hash text;
  v_verification_id uuid;
  v_issued_at timestamptz;
  v_retention_years int;
  v_retention_until date;
  v_payment_method payment_methods%ROWTYPE;
  v_payment_snapshot jsonb;
  v_tax_schema tax_schemas%ROWTYPE;
  v_tax_schema_snapshot jsonb;
  v_tax_schema_version text := NULL;
  v_template invoice_templates%ROWTYPE;
  v_template_snapshot jsonb;
  v_user_id uuid;
  v_account_status text;
  v_checks jsonb := '[]'::jsonb;
  v_line_item_sum numeric;
  v_score int := 100;
  v_has_block boolean := false;
  v_has_warn boolean := false;
  v_compliance_result jsonb;
  v_compliance_hash text;
BEGIN
  v_user_id := auth.uid();

  SELECT account_status INTO v_account_status FROM public.profiles WHERE id = v_user_id;
  IF v_account_status IS DISTINCT FROM 'active' AND v_account_status IS NOT NULL THEN
    RAISE EXCEPTION 'Account is suspended. You cannot issue invoices.';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;

  IF v_invoice.user_id != v_user_id AND NOT public.is_business_member(v_user_id, v_invoice.business_id) THEN
    RAISE EXCEPTION 'Not authorized to issue this invoice';
  END IF;

  SELECT * INTO v_business FROM public.businesses WHERE id = v_invoice.business_id;
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_invoice.client_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ii.id,
      'description', ii.description,
      'quantity', ii.quantity,
      'unit_price', ii.unit_price,
      'tax_rate', ii.tax_rate,
      'tax_amount', ii.tax_amount,
      'tax_label', ii.tax_label,
      'discount_percent', ii.discount_percent,
      'amount', ii.amount,
      'sort_order', ii.sort_order
    ) ORDER BY ii.sort_order
  ) INTO v_items
  FROM public.invoice_items ii
  WHERE ii.invoice_id = _invoice_id;

  IF v_items IS NULL THEN
    RAISE EXCEPTION 'Invoice must have at least one item';
  END IF;

  IF v_invoice.payment_method_id IS NOT NULL THEN
    SELECT * INTO v_payment_method FROM public.payment_methods WHERE id = v_invoice.payment_method_id;
    IF v_payment_method.id IS NOT NULL THEN
      v_payment_snapshot := jsonb_build_object(
        'id', v_payment_method.id,
        'display_name', v_payment_method.display_name,
        'provider_type', v_payment_method.provider_type,
        'instructions', v_payment_method.instructions
      );
    END IF;
  END IF;

  IF v_invoice.tax_schema_id IS NOT NULL THEN
    SELECT * INTO v_tax_schema FROM public.tax_schemas WHERE id = v_invoice.tax_schema_id;
    IF v_tax_schema.id IS NOT NULL THEN
      v_tax_schema_snapshot := jsonb_build_object(
        'id', v_tax_schema.id,
        'name', v_tax_schema.name,
        'jurisdiction', v_tax_schema.jurisdiction,
        'rates', v_tax_schema.rates,
        'rules', v_tax_schema.rules,
        'version', v_tax_schema.version,
        'effective_from', v_tax_schema.effective_from,
        'effective_until', v_tax_schema.effective_until,
        'is_active', v_tax_schema.is_active
      );
      v_tax_schema_version := v_tax_schema.version;
    END IF;
  END IF;

  IF v_invoice.template_id IS NOT NULL THEN
    SELECT * INTO v_template FROM public.invoice_templates WHERE id = v_invoice.template_id;
    IF v_template.id IS NOT NULL THEN
      v_template_snapshot := jsonb_build_object(
        'id', v_template.id,
        'name', v_template.name,
        'layout', v_template.layout,
        'styles', v_template.styles,
        'supports_branding', v_template.supports_branding,
        'watermark_required', v_template.watermark_required
      );
    END IF;
  END IF;

  -- ========== COMPLIANCE CHECKS ==========

  -- 1. missing_client_email (warn, -5)
  IF v_client.email IS NULL OR trim(v_client.email) = '' THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_client_email', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Client email is missing'
    ));
    v_score := v_score - 5;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_client_email', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true,
      'message', 'Client email present'
    ));
  END IF;

  -- 2. missing_tax_id (warn, -5)
  IF (v_business.government_id_value IS NULL OR trim(v_business.government_id_value) = '')
     AND (v_business.tax_id IS NULL OR trim(v_business.tax_id) = '') THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_tax_id', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Business tax/government ID is missing'
    ));
    v_score := v_score - 5;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_tax_id', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true,
      'message', 'Business tax/government ID present'
    ));
  END IF;

  -- 3. missing_address (warn, -5)
  IF v_business.address IS NULL OR v_business.address = '{}'::jsonb THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_address', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Business address is missing'
    ));
    v_score := v_score - 5;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_address', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true,
      'message', 'Business address present'
    ));
  END IF;

  -- 4. line_item_mismatch (block)
  SELECT COALESCE(SUM(ii.amount), 0)
  INTO v_line_item_sum
  FROM public.invoice_items ii
  WHERE ii.invoice_id = _invoice_id;

  IF abs(v_line_item_sum - v_invoice.subtotal) > 0.01 THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'line_item_mismatch', 'rule_type', 'calculation',
      'severity', 'block', 'passed', false,
      'message', format('Line item total (%s) does not match subtotal (%s)', v_line_item_sum, v_invoice.subtotal)
    ));
    v_has_block := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'line_item_mismatch', 'rule_type', 'calculation',
      'severity', 'block', 'passed', true,
      'message', 'Line items match subtotal'
    ));
  END IF;

  -- 5. Jurisdiction-specific compliance validation rules
  DECLARE
    v_rule RECORD;
    v_rule_passed boolean;
    v_rule_message text;
    v_field_value text;
    v_require_rules boolean;
    v_has_jurisdiction_rules boolean;
  BEGIN
    SELECT require_rules_for_jurisdiction INTO v_require_rules
    FROM public.compliance_system_policy
    WHERE id = true
    LIMIT 1;

    IF v_require_rules IS NULL THEN
      v_require_rules := false;
    END IF;

    IF v_require_rules AND v_business.jurisdiction IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.compliance_validation_rules
        WHERE jurisdiction = v_business.jurisdiction AND is_active = true
      ) INTO v_has_jurisdiction_rules;

      IF NOT v_has_jurisdiction_rules THEN
        v_checks := v_checks || jsonb_build_array(jsonb_build_object(
          'rule_key', 'no_jurisdiction_rules',
          'rule_type', 'jurisdiction',
          'severity', 'block',
          'passed', false,
          'message', format('No compliance rules configured for jurisdiction %s. Invoice issuance is blocked until rules are set up.', v_business.jurisdiction)
        ));
        v_has_block := true;
      END IF;
    END IF;

    FOR v_rule IN
      SELECT * FROM public.compliance_validation_rules
      WHERE jurisdiction = v_business.jurisdiction AND is_active = true
    LOOP
      v_rule_passed := true;
      v_rule_message := 'Check passed';

      IF v_rule.rule_type = 'field_presence' THEN
        v_field_value := CASE (v_rule.rule_definition->>'field')
          WHEN 'tax_id' THEN COALESCE(v_business.government_id_value, v_business.tax_id)
          WHEN 'government_id_value' THEN v_business.government_id_value
          WHEN 'vat_registration_number' THEN v_business.vat_registration_number
          WHEN 'cac_number' THEN v_business.cac_number
          WHEN 'legal_name' THEN v_business.legal_name
          WHEN 'address' THEN v_business.address::text
          WHEN 'contact_email' THEN v_business.contact_email
          WHEN 'contact_phone' THEN v_business.contact_phone
          WHEN 'client_email' THEN v_client.email
          WHEN 'client_tax_id' THEN v_client.tax_id
          WHEN 'client_address' THEN v_client.address::text
          ELSE NULL
        END;

        IF v_field_value IS NULL OR trim(v_field_value) = '' OR v_field_value = '{}' THEN
          v_rule_passed := false;
          v_rule_message := COALESCE(
            v_rule.rule_definition->>'message',
            format('Required field %s is missing', v_rule.rule_definition->>'field')
          );
        END IF;

      ELSIF v_rule.rule_type = 'format_validation' THEN
        v_field_value := CASE (v_rule.rule_definition->>'field')
          WHEN 'tax_id' THEN COALESCE(v_business.government_id_value, v_business.tax_id)
          WHEN 'government_id_value' THEN v_business.government_id_value
          WHEN 'vat_registration_number' THEN v_business.vat_registration_number
          WHEN 'cac_number' THEN v_business.cac_number
          WHEN 'client_tax_id' THEN v_client.tax_id
          ELSE NULL
        END;

        IF v_field_value IS NOT NULL AND v_rule.rule_definition->>'pattern' IS NOT NULL THEN
          IF v_field_value !~ (v_rule.rule_definition->>'pattern') THEN
            v_rule_passed := false;
            v_rule_message := COALESCE(
              v_rule.rule_definition->>'message',
              format('Field %s does not match required format', v_rule.rule_definition->>'field')
            );
          END IF;
        END IF;
      END IF;

      IF NOT v_rule_passed THEN
        IF v_rule.severity = 'block' THEN
          v_has_block := true;
        ELSIF v_rule.severity = 'warning' THEN
          v_score := v_score - 5;
          v_has_warn := true;
        END IF;
      END IF;

      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'rule_key', v_rule.rule_key,
        'rule_type', v_rule.rule_type,
        'severity', v_rule.severity,
        'passed', v_rule_passed,
        'message', v_rule_message
      ));
    END LOOP;
  END;

  IF v_has_block THEN
    v_compliance_result := jsonb_build_object(
      'status', 'blocked',
      'score', 0,
      'checks', v_checks,
      'checked_at', now()
    );
    v_compliance_hash := encode(extensions.digest(v_compliance_result::text, 'sha256'), 'hex');

    UPDATE public.invoices SET
      compliance_result = v_compliance_result,
      compliance_hash = v_compliance_hash
    WHERE id = _invoice_id;

    RAISE EXCEPTION 'Invoice blocked by compliance checks. Review compliance result for details.';
  END IF;

  v_compliance_result := jsonb_build_object(
    'status', CASE WHEN v_has_warn THEN 'warning' ELSE 'pass' END,
    'score', GREATEST(v_score, 0),
    'checks', v_checks,
    'checked_at', now()
  );
  v_compliance_hash := encode(extensions.digest(v_compliance_result::text, 'sha256'), 'hex');

  v_verification_id := gen_random_uuid();
  v_issued_at := now();

  v_hash_input := concat_ws('|',
    v_invoice.invoice_number,
    v_invoice.total_amount::text,
    v_invoice.currency,
    v_issued_at::text,
    v_verification_id::text
  );
  v_hash := encode(extensions.digest(v_hash_input, 'sha256'), 'hex');

  SELECT COALESCE(retention_years, 7) INTO v_retention_years
  FROM public.retention_policies
  WHERE jurisdiction = v_business.jurisdiction AND entity_type = 'invoice'
  LIMIT 1;
  IF v_retention_years IS NULL THEN
    SELECT COALESCE(retention_years, 7) INTO v_retention_years
    FROM public.retention_policies
    WHERE jurisdiction = 'DEFAULT' AND entity_type = 'invoice'
    LIMIT 1;
  END IF;

  v_retention_until := (v_issued_at + (COALESCE(v_retention_years, 7) || ' years')::interval)::date;

  UPDATE public.invoices SET
    status = 'issued',
    issued_at = v_issued_at,
    issued_by = v_user_id,
    issue_date = COALESCE(issue_date, v_issued_at::date),
    verification_id = v_verification_id,
    invoice_hash = v_hash,
    compliance_result = v_compliance_result,
    compliance_hash = v_compliance_hash,
    retention_locked_until = v_retention_until,
    issuer_snapshot = jsonb_build_object(
      'business_id', v_business.id,
      'business_name', v_business.name,
      'legal_name', v_business.legal_name,
      'tax_id', v_business.tax_id,
      'vat_number', v_business.vat_registration_number,
      'address', v_business.address,
      'contact_email', v_business.contact_email,
      'contact_phone', v_business.contact_phone,
      'jurisdiction', v_business.jurisdiction,
      'logo_url', v_business.logo_url,
      'entity_type', v_business.entity_type,
      'government_id_type', v_business.government_id_type,
      'government_id_value', v_business.government_id_value
    ),
    recipient_snapshot = jsonb_build_object(
      'client_id', v_client.id,
      'name', v_client.name,
      'client_name', v_client.name,
      'contact_person', v_client.contact_person,
      'email', v_client.email,
      'phone', v_client.phone,
      'tax_id', v_client.tax_id,
      'address', v_client.address
    ),
    payment_method_snapshot = COALESCE(v_payment_snapshot, payment_method_snapshot),
    tax_schema_snapshot = COALESCE(v_tax_schema_snapshot, tax_schema_snapshot),
    tax_schema_version = COALESCE(v_tax_schema_version, tax_schema_version),
    template_snapshot = COALESCE(v_template_snapshot, template_snapshot),
    updated_at = v_issued_at
  WHERE id = _invoice_id;

  INSERT INTO public.audit_logs (
    event_type, entity_type, entity_id, user_id, actor_id, actor_role,
    business_id, new_state, event_hash
  ) VALUES (
    'INVOICE_ISSUED', 'invoice', _invoice_id, v_user_id, v_user_id, 'user',
    v_invoice.business_id,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total_amount', v_invoice.total_amount,
      'currency', v_invoice.currency,
      'verification_id', v_verification_id,
      'invoice_hash', v_hash,
      'compliance_score', v_score,
      'issued_at', v_issued_at
    ),
    encode(extensions.digest(
      concat(_invoice_id::text, '|INVOICE_ISSUED|', v_issued_at::text)::bytea, 'sha256'
    ), 'hex')
  );

  RETURN jsonb_build_object(
    'id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'verification_id', v_verification_id,
    'issued_at', v_issued_at,
    'invoice_hash', v_hash,
    'business_id', v_invoice.business_id,
    'compliance_score', v_score,
    'compliance_result', CASE
      WHEN v_has_block THEN 'block'
      WHEN v_has_warn THEN 'warn'
      ELSE 'pass'
    END
  );
END;
$function$;