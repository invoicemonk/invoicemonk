-- Drop both overloaded versions
DROP FUNCTION IF EXISTS public.issue_invoice(uuid);
DROP FUNCTION IF EXISTS public.issue_invoice(uuid, uuid);

-- Recreate the correct 1-param version with status = 'issued'
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

  IF v_business.name IS NULL OR trim(v_business.name) = '' THEN
    RAISE EXCEPTION 'Business profile incomplete. Missing: Business Name';
  END IF;
  IF v_business.contact_email IS NULL OR trim(v_business.contact_email) = '' THEN
    RAISE EXCEPTION 'Business profile incomplete. Missing: Contact Email';
  END IF;
  IF v_business.jurisdiction IS NULL OR trim(v_business.jurisdiction) = '' THEN
    RAISE EXCEPTION 'Business profile incomplete. Missing: Country';
  END IF;
  IF v_business.address IS NULL OR v_business.address = '{}'::jsonb
     OR (v_business.address->>'country') IS NULL OR trim(v_business.address->>'country') = '' THEN
    RAISE EXCEPTION 'Business profile incomplete. Missing: Address Country';
  END IF;
  IF v_business.entity_type != 'individual' THEN
    IF v_business.legal_name IS NULL OR trim(v_business.legal_name) = '' THEN
      RAISE EXCEPTION 'Business profile incomplete. Missing: Legal Name';
    END IF;
    IF (v_business.tax_id IS NULL OR trim(v_business.tax_id) = '')
       AND (v_business.government_id_value IS NULL OR trim(v_business.government_id_value) = '') THEN
      RAISE EXCEPTION 'Business profile incomplete. Missing: Tax ID or Government ID';
    END IF;
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

  -- Compliance checks
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
      'severity', 'warning', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF v_business.contact_email IS NULL OR trim(v_business.contact_email) = '' THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_business_email', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Business contact email is missing'
    ));
    v_score := v_score - 10;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_business_email', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF (v_business.tax_id IS NULL OR trim(v_business.tax_id) = '')
     AND (v_business.government_id_value IS NULL OR trim(v_business.government_id_value) = '') THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_tax_id', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Business tax ID / government ID is missing'
    ));
    v_score := v_score - 10;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_tax_id', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF v_business.address IS NULL OR v_business.address = '{}'::jsonb THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_business_address', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Business address is missing'
    ));
    v_score := v_score - 10;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_business_address', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF v_business.entity_type != 'individual' AND (v_business.legal_name IS NULL OR trim(v_business.legal_name) = '') THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_legal_name', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', false,
      'message', 'Legal name is missing'
    ));
    v_score := v_score - 5;
    v_has_warn := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'missing_legal_name', 'rule_type', 'field_presence',
      'severity', 'warning', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF v_invoice.total_amount <= 0 THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'zero_total', 'rule_type', 'amount_validation',
      'severity', 'block', 'passed', false,
      'message', 'Invoice total must be > 0'
    ));
    v_has_block := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'zero_total', 'rule_type', 'amount_validation',
      'severity', 'block', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF v_invoice.currency_account_id IS NOT NULL THEN
    DECLARE
      v_account_currency text;
    BEGIN
      SELECT currency INTO v_account_currency
      FROM public.currency_accounts
      WHERE id = v_invoice.currency_account_id;

      IF v_account_currency IS NOT NULL AND v_account_currency != v_invoice.currency THEN
        v_checks := v_checks || jsonb_build_array(jsonb_build_object(
          'rule_key', 'currency_mismatch', 'rule_type', 'consistency',
          'severity', 'block', 'passed', false,
          'message', 'Invoice currency does not match currency account'
        ));
        v_has_block := true;
      ELSE
        v_checks := v_checks || jsonb_build_array(jsonb_build_object(
          'rule_key', 'currency_mismatch', 'rule_type', 'consistency',
          'severity', 'block', 'passed', true, 'message', 'OK'
        ));
      END IF;
    END;
  END IF;

  SELECT COALESCE(SUM(ii.amount), 0) INTO v_line_item_sum
  FROM public.invoice_items ii WHERE ii.invoice_id = _invoice_id;

  IF abs(v_line_item_sum - v_invoice.subtotal) > 0.01 THEN
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'subtotal_mismatch', 'rule_type', 'amount_validation',
      'severity', 'block', 'passed', false,
      'message', format('Subtotal mismatch: items sum to %s but invoice subtotal is %s',
                        v_line_item_sum, v_invoice.subtotal)
    ));
    v_has_block := true;
  ELSE
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'rule_key', 'subtotal_mismatch', 'rule_type', 'amount_validation',
      'severity', 'block', 'passed', true, 'message', 'OK'
    ));
  END IF;

  IF v_has_block THEN
    v_score := 0;
  END IF;

  v_compliance_result := jsonb_build_object(
    'score', v_score,
    'has_block', v_has_block,
    'has_warning', v_has_warn,
    'checks', v_checks
  );
  v_compliance_hash := encode(extensions.digest(v_compliance_result::text, 'sha256'), 'hex');

  IF v_has_block THEN
    UPDATE public.invoices
    SET compliance_result = v_compliance_result,
        compliance_hash = v_compliance_hash,
        trust_score = v_score,
        updated_at = now()
    WHERE id = _invoice_id;

    RETURN jsonb_build_object(
      'success', false,
      'blocked', true,
      'compliance', v_compliance_result
    );
  END IF;

  v_issued_at := now();
  v_verification_id := gen_random_uuid();

  v_hash_input := v_invoice.id::text || '|' || v_invoice.invoice_number || '|' ||
    v_invoice.total_amount::text || '|' || v_invoice.currency || '|' || v_issued_at::text;
  v_hash := encode(extensions.digest(v_hash_input, 'sha256'), 'hex');

  v_retention_years := COALESCE(
    (SELECT rp.retention_years FROM public.retention_policies rp
     WHERE rp.jurisdiction = v_business.jurisdiction AND rp.entity_type = 'invoice' LIMIT 1),
    7
  );
  v_retention_until := (v_issued_at + (v_retention_years || ' years')::interval)::date;

  -- FIX: Changed from 'sent' to 'issued'
  UPDATE public.invoices
  SET status = 'issued',
      issued_at = v_issued_at,
      issued_by = v_user_id,
      issue_date = v_issued_at::date,
      invoice_hash = v_hash,
      verification_id = v_verification_id,
      retention_locked_until = v_retention_until,
      compliance_result = v_compliance_result,
      compliance_hash = v_compliance_hash,
      trust_score = v_score,
      payment_method_snapshot = v_payment_snapshot,
      tax_schema_snapshot = v_tax_schema_snapshot,
      tax_schema_version = v_tax_schema_version,
      template_snapshot = v_template_snapshot,
      issuer_snapshot = jsonb_build_object(
        'business_id', v_business.id,
        'business_name', v_business.name,
        'legal_name', v_business.legal_name,
        'entity_type', v_business.entity_type,
        'contact_email', v_business.contact_email,
        'contact_phone', v_business.contact_phone,
        'address', v_business.address,
        'tax_id', v_business.tax_id,
        'vat_registration_number', v_business.vat_registration_number,
        'jurisdiction', v_business.jurisdiction,
        'logo_url', v_business.logo_url,
        'brand_color', v_business.brand_color,
        'government_id_type', v_business.government_id_type,
        'government_id_value', v_business.government_id_value
      ),
      recipient_snapshot = jsonb_build_object(
        'client_id', v_client.id,
        'name', v_client.name,
        'email', v_client.email,
        'phone', v_client.phone,
        'address', v_client.address,
        'tax_id', v_client.tax_id,
        'cac_number', v_client.cac_number,
        'contact_person', v_client.contact_person
      ),
      updated_at = now()
  WHERE id = _invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'verification_id', v_verification_id,
    'invoice_hash', v_hash,
    'issued_at', v_issued_at,
    'retention_locked_until', v_retention_until,
    'compliance', v_compliance_result
  );
END;
$function$;
