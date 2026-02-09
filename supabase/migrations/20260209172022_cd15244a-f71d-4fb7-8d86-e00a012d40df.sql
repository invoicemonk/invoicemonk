
-- Fix issue_invoice: use unprefixed keys in recipient_snapshot
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
 RETURNS SETOF invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice invoices%ROWTYPE;
  _business businesses%ROWTYPE;
  _client clients%ROWTYPE;
  _retention_years INTEGER;
  _tax_schema tax_schemas%ROWTYPE;
  _hash_input TEXT;
  _invoice_hash TEXT;
  _pm_snapshot JSONB;
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

  -- Generate hash using extensions.digest
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
      'total_amount', _invoice.total_amount
    )
  );

  -- Notify admin on first invoice
  IF (SELECT COUNT(*) FROM invoices WHERE business_id = _invoice.business_id AND status != 'draft') = 1 THEN
    PERFORM notify_admin_first_invoice_issued(_invoice.business_id, _invoice_id, _invoice.invoice_number);
  END IF;

  RETURN QUERY SELECT * FROM invoices WHERE id = _invoice_id;
END;
$function$;

-- Backfill existing invoices with wrong keys
UPDATE invoices
SET recipient_snapshot = jsonb_build_object(
  'name', recipient_snapshot->>'client_name',
  'email', recipient_snapshot->>'client_email',
  'phone', recipient_snapshot->>'client_phone',
  'address', recipient_snapshot->'client_address',
  'contact_person', recipient_snapshot->>'contact_person',
  'tax_id', recipient_snapshot->>'tax_id',
  'cac_number', recipient_snapshot->>'cac_number'
)
WHERE recipient_snapshot->>'client_name' IS NOT NULL
  AND recipient_snapshot->>'name' IS NULL;
