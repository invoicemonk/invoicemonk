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
  v_payment_method RECORD;
  v_payment_snapshot jsonb;
  v_tax_schema RECORD;
  v_tax_schema_snapshot jsonb;
  v_template RECORD;
  v_template_snapshot jsonb;
  v_user_id uuid;
  v_account_status text;
BEGIN
  v_user_id := auth.uid();
  
  SELECT account_status INTO v_account_status FROM profiles WHERE id = v_user_id;
  IF v_account_status IS DISTINCT FROM 'active' AND v_account_status IS NOT NULL THEN
    RAISE EXCEPTION 'Account is suspended. You cannot issue invoices.';
  END IF;

  SELECT * INTO v_invoice FROM invoices WHERE id = _invoice_id;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;

  IF v_invoice.user_id != v_user_id AND NOT is_business_member(v_user_id, v_invoice.business_id) THEN
    RAISE EXCEPTION 'Not authorized to issue this invoice';
  END IF;

  SELECT * INTO v_business FROM businesses WHERE id = v_invoice.business_id;
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_invoice.client_id;
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
  FROM invoice_items ii
  WHERE ii.invoice_id = _invoice_id;

  IF v_items IS NULL THEN
    RAISE EXCEPTION 'Invoice must have at least one item';
  END IF;

  IF v_invoice.payment_method_id IS NOT NULL THEN
    SELECT * INTO v_payment_method FROM payment_methods WHERE id = v_invoice.payment_method_id;
    IF v_payment_method IS NOT NULL THEN
      v_payment_snapshot := jsonb_build_object(
        'id', v_payment_method.id,
        'display_name', v_payment_method.display_name,
        'provider_type', v_payment_method.provider_type,
        'instructions', v_payment_method.instructions
      );
    END IF;
  END IF;

  IF v_invoice.tax_schema_id IS NOT NULL THEN
    SELECT * INTO v_tax_schema FROM tax_schemas WHERE id = v_invoice.tax_schema_id;
    IF v_tax_schema IS NOT NULL THEN
      v_tax_schema_snapshot := jsonb_build_object(
        'id', v_tax_schema.id,
        'name', v_tax_schema.name,
        'jurisdiction', v_tax_schema.jurisdiction,
        'schema_data', v_tax_schema.schema_data,
        'version', v_tax_schema.version,
        'effective_from', v_tax_schema.effective_from
      );
    END IF;
  END IF;

  IF v_invoice.template_id IS NOT NULL THEN
    SELECT * INTO v_template FROM invoice_templates WHERE id = v_invoice.template_id;
    IF v_template IS NOT NULL THEN
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

  v_verification_id := gen_random_uuid();
  v_issued_at := now();

  v_hash_input := concat(
    v_invoice.id::text, '|',
    v_invoice.invoice_number, '|',
    v_business.id::text, '|',
    v_business.name, '|',
    v_business.tax_id, '|',
    v_client.id::text, '|',
    v_client.name, '|',
    v_client.tax_id, '|',
    v_invoice.subtotal::text, '|',
    v_invoice.tax_amount::text, '|',
    v_invoice.discount_amount::text, '|',
    v_invoice.total_amount::text, '|',
    v_invoice.currency, '|',
    v_items::text, '|',
    v_issued_at::text, '|',
    v_verification_id::text
  );

  v_hash := encode(extensions.digest(v_hash_input::bytea, 'sha256'), 'hex');

  SELECT retention_years INTO v_retention_years
  FROM retention_policies
  WHERE jurisdiction = COALESCE(v_business.jurisdiction, 'DEFAULT')
    AND entity_type = 'invoice'
  LIMIT 1;

  IF v_retention_years IS NULL THEN
    SELECT retention_years INTO v_retention_years
    FROM retention_policies
    WHERE jurisdiction = 'DEFAULT' AND entity_type = 'invoice'
    LIMIT 1;
  END IF;

  v_retention_until := (v_issued_at + (COALESCE(v_retention_years, 7) || ' years')::interval)::date;

  UPDATE invoices SET
    status = 'sent',
    issued_at = v_issued_at,
    issued_by = v_user_id,
    issue_date = v_issued_at::date,
    verification_id = v_verification_id,
    invoice_hash = v_hash,
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
      'logo_url', v_business.logo_url
    ),
    recipient_snapshot = jsonb_build_object(
      'client_id', v_client.id,
      'client_name', v_client.name,
      'contact_person', v_client.contact_person,
      'email', v_client.email,
      'phone', v_client.phone,
      'tax_id', v_client.tax_id,
      'address', v_client.address,
      'client_type', v_client.client_type
    ),
    payment_method_snapshot = v_payment_snapshot,
    tax_schema_snapshot = v_tax_schema_snapshot,
    tax_schema_version = CASE WHEN v_tax_schema IS NOT NULL THEN v_tax_schema.version ELSE NULL END,
    template_snapshot = v_template_snapshot,
    currency_locked_at = CASE WHEN currency_locked_at IS NULL THEN v_issued_at ELSE currency_locked_at END,
    updated_at = v_issued_at
  WHERE id = _invoice_id;

  IF NOT v_business.currency_locked THEN
    UPDATE businesses SET
      currency_locked = true,
      currency_locked_at = v_issued_at
    WHERE id = v_business.id;
  END IF;

  INSERT INTO audit_logs (
    event_type, entity_type, entity_id, user_id, actor_id,
    business_id, new_state, metadata
  ) VALUES (
    'INVOICE_ISSUED', 'invoice', _invoice_id, v_user_id, v_user_id,
    v_business.id,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total_amount', v_invoice.total_amount,
      'currency', v_invoice.currency,
      'verification_id', v_verification_id,
      'hash', v_hash
    ),
    jsonb_build_object(
      'retention_locked_until', v_retention_until,
      'hash_algorithm', 'sha256'
    )
  );

  RETURN jsonb_build_object(
    'id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'verification_id', v_verification_id,
    'issued_at', v_issued_at,
    'invoice_hash', v_hash,
    'business_id', v_business.id
  );
END;
$function$;