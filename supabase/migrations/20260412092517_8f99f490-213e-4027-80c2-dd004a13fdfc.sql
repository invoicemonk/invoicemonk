CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_business RECORD;
  v_client RECORD;
  v_issued_at timestamptz := now();
  v_hash text;
  v_verification_id uuid := gen_random_uuid();
  v_retention_years int;
  v_retention_until date;
  v_score int;
  v_compliance_result jsonb;
  v_compliance_hash text;
  v_payment_snapshot jsonb;
  v_tax_schema_snapshot jsonb;
  v_tax_schema_version text;
  v_issuer_snapshot jsonb;
  v_recipient_snapshot jsonb;
  v_template_snapshot jsonb;
  v_system_policy RECORD;
  v_rules_exist boolean;
  v_profile_missing text[];
BEGIN
  -- Lock the invoice row
  SELECT * INTO v_invoice FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  IF v_invoice.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft invoices can be issued');
  END IF;

  -- Fetch business
  SELECT * INTO v_business FROM public.businesses WHERE id = v_invoice.business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Business not found');
  END IF;

  -- Business-profile completeness gate
  v_profile_missing := ARRAY[]::text[];
  IF v_business.name IS NULL OR v_business.name = '' THEN
    v_profile_missing := array_append(v_profile_missing, 'business_name');
  END IF;
  IF v_business.address IS NULL THEN
    v_profile_missing := array_append(v_profile_missing, 'address');
  END IF;
  IF v_business.contact_email IS NULL OR v_business.contact_email = '' THEN
    v_profile_missing := array_append(v_profile_missing, 'contact_email');
  END IF;
  IF v_business.jurisdiction IS NULL OR v_business.jurisdiction = '' THEN
    v_profile_missing := array_append(v_profile_missing, 'jurisdiction');
  END IF;

  IF array_length(v_profile_missing, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Business profile incomplete',
      'missing_fields', to_jsonb(v_profile_missing)
    );
  END IF;

  -- Fetch client
  SELECT * INTO v_client FROM public.clients WHERE id = v_invoice.client_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client not found');
  END IF;

  -- Check system compliance policy
  SELECT * INTO v_system_policy FROM public.compliance_system_policy LIMIT 1;
  IF v_system_policy.require_rules_for_jurisdiction THEN
    SELECT EXISTS(
      SELECT 1 FROM public.compliance_validation_rules
      WHERE jurisdiction = v_business.jurisdiction AND is_active = true
    ) INTO v_rules_exist;
    IF NOT v_rules_exist THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('No active compliance rules for jurisdiction %s', v_business.jurisdiction)
      );
    END IF;
  END IF;

  -- Compliance scoring
  v_score := 50;
  IF v_business.name IS NOT NULL AND v_business.name <> '' THEN v_score := v_score + 5; END IF;
  IF v_business.address IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_business.tax_id IS NOT NULL AND v_business.tax_id <> '' THEN v_score := v_score + 10; END IF;
  IF v_business.contact_email IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_business.verification_status = 'verified' THEN v_score := v_score + 15; END IF;
  IF v_client.email IS NOT NULL AND v_client.email <> '' THEN v_score := v_score + 5; END IF;
  IF v_client.address IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_score > 100 THEN v_score := 100; END IF;

  -- Compliance result
  v_compliance_result := jsonb_build_object(
    'score', v_score,
    'jurisdiction', v_business.jurisdiction,
    'business_verified', v_business.verification_status = 'verified',
    'has_tax_id', v_business.tax_id IS NOT NULL AND v_business.tax_id <> '',
    'checked_at', v_issued_at
  );
  v_compliance_hash := encode(digest(v_compliance_result::text, 'sha256'), 'hex');

  -- Invoice hash
  v_hash := encode(digest(
    v_invoice.id::text || v_invoice.invoice_number || v_invoice.total_amount::text || v_issued_at::text,
    'sha256'
  ), 'hex');

  -- Payment method snapshot
  IF v_invoice.payment_method_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', pm.id,
      'display_name', pm.display_name,
      'provider_type', pm.provider_type,
      'instructions', pm.instructions
    ) INTO v_payment_snapshot
    FROM public.payment_methods pm
    WHERE pm.id = v_invoice.payment_method_id;
  END IF;

  -- Tax schema snapshot
  IF v_invoice.tax_schema_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', ts.id,
      'name', ts.name,
      'jurisdiction', ts.jurisdiction,
      'rates', ts.rates,
      'version', ts.version
    ), ts.version
    INTO v_tax_schema_snapshot, v_tax_schema_version
    FROM public.tax_schemas ts
    WHERE ts.id = v_invoice.tax_schema_id;
  END IF;

  -- Template snapshot
  IF v_invoice.template_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'layout', t.layout,
      'styles', t.styles
    ) INTO v_template_snapshot
    FROM public.invoice_templates t
    WHERE t.id = v_invoice.template_id;
  END IF;

  -- Retention policy
  v_retention_years := COALESCE(
    (SELECT rp.retention_years FROM public.retention_policies rp
     WHERE rp.jurisdiction = v_business.jurisdiction AND rp.entity_type = 'invoice' LIMIT 1),
    7
  );
  v_retention_until := (v_issued_at + (v_retention_years || ' years')::interval)::date;

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
        'name', v_business.name,
        'legal_name', v_business.legal_name,
        'tax_id', v_business.tax_id,
        'address', v_business.address,
        'contact_email', v_business.contact_email,
        'contact_phone', v_business.contact_phone,
        'jurisdiction', v_business.jurisdiction,
        'logo_url', v_business.logo_url,
        'brand_color', v_business.brand_color,
        'is_vat_registered', v_business.is_vat_registered,
        'vat_registration_number', v_business.vat_registration_number,
        'verification_status', v_business.verification_status
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
$$;