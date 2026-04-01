-- Update the function to use business-unique receipt numbers
CREATE OR REPLACE FUNCTION public.create_receipt_from_payment(_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payment RECORD;
  _invoice RECORD;
  _client RECORD;
  _business RECORD;
  _retention_policy RECORD;
  _retention_years INTEGER;
  _receipt_id UUID;
  _receipt_number TEXT;
  _receipt_seq INTEGER;
  _verification_id UUID;
  _hash_input TEXT;
  _receipt_hash TEXT;
  _issued_at TIMESTAMPTZ;
  _issuer_snapshot JSONB;
  _payer_snapshot JSONB;
  _invoice_snapshot JSONB;
  _payment_snapshot JSONB;
  _biz_short TEXT;
BEGIN
  SELECT * INTO _payment FROM payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', _payment_id;
  END IF;

  IF EXISTS (SELECT 1 FROM receipts WHERE payment_id = _payment_id) THEN
    SELECT id INTO _receipt_id FROM receipts WHERE payment_id = _payment_id;
    RETURN _receipt_id;
  END IF;

  SELECT * INTO _invoice FROM invoices WHERE id = _payment.invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found for payment: %', _payment_id;
  END IF;

  SELECT * INTO _business FROM businesses WHERE id = _invoice.business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found for invoice: %', _invoice.id;
  END IF;

  SELECT * INTO _client FROM clients WHERE id = _invoice.client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found for invoice: %', _invoice.id;
  END IF;

  SELECT * INTO _retention_policy 
  FROM retention_policies 
  WHERE jurisdiction = _business.jurisdiction 
    AND entity_type = 'invoice'
  ORDER BY created_at DESC
  LIMIT 1;
  
  _retention_years := COALESCE(_retention_policy.retention_years, 7);

  UPDATE businesses 
  SET next_receipt_number = next_receipt_number + 1
  WHERE id = _business.id
  RETURNING next_receipt_number - 1 INTO _receipt_seq;

  -- Use upper 4 chars of business ID for uniqueness across businesses
  _biz_short := UPPER(LEFT(_business.id::TEXT, 4));
  _receipt_number := 'RCP-' || _biz_short || '-' || LPAD(_receipt_seq::TEXT, 4, '0');
  _verification_id := gen_random_uuid();
  _issued_at := now();

  _issuer_snapshot := jsonb_build_object(
    'name', _business.name,
    'legal_name', _business.legal_name,
    'tax_id', _business.tax_id,
    'cac_number', _business.cac_number,
    'address', _business.address,
    'contact_email', _business.contact_email,
    'contact_phone', _business.contact_phone,
    'logo_url', _business.logo_url,
    'jurisdiction', _business.jurisdiction,
    'is_vat_registered', _business.is_vat_registered,
    'vat_registration_number', _business.vat_registration_number
  );

  _payer_snapshot := jsonb_build_object(
    'name', _client.name,
    'email', _client.email,
    'phone', _client.phone,
    'tax_id', _client.tax_id,
    'cac_number', _client.cac_number,
    'client_type', _client.client_type,
    'contact_person', _client.contact_person,
    'address', _client.address
  );

  _invoice_snapshot := jsonb_build_object(
    'invoice_number', _invoice.invoice_number,
    'total_amount', _invoice.total_amount,
    'issue_date', _invoice.issue_date,
    'due_date', _invoice.due_date,
    'currency', _invoice.currency
  );

  _payment_snapshot := jsonb_build_object(
    'payment_method', _payment.payment_method,
    'payment_reference', _payment.payment_reference,
    'payment_date', _payment.payment_date,
    'notes', _payment.notes
  );

  _hash_input := _receipt_number || '|' || _invoice.id::TEXT || '|' || _payment_id::TEXT || '|' || 
                 _payment.amount::TEXT || '|' || _invoice.currency || '|' || _issued_at::TEXT;
  _receipt_hash := encode(sha256(_hash_input::bytea), 'hex');

  INSERT INTO receipts (
    receipt_number,
    invoice_id,
    payment_id,
    business_id,
    amount,
    currency,
    currency_account_id,
    receipt_hash,
    verification_id,
    issuer_snapshot,
    payer_snapshot,
    invoice_snapshot,
    payment_snapshot,
    issued_at,
    retention_locked_until
  ) VALUES (
    _receipt_number,
    _invoice.id,
    _payment_id,
    _business.id,
    _payment.amount,
    _invoice.currency,
    _invoice.currency_account_id,
    _receipt_hash,
    _verification_id,
    _issuer_snapshot,
    _payer_snapshot,
    _invoice_snapshot,
    _payment_snapshot,
    _issued_at,
    (_issued_at + (_retention_years || ' years')::INTERVAL)::DATE
  )
  RETURNING id INTO _receipt_id;

  RETURN _receipt_id;
END;
$$;

-- Now backfill orphaned payments
DO $$
DECLARE
  _pid UUID;
BEGIN
  FOR _pid IN 
    SELECT p.id FROM payments p 
    LEFT JOIN receipts r ON r.payment_id = p.id 
    WHERE r.id IS NULL
  LOOP
    PERFORM create_receipt_from_payment(_pid);
  END LOOP;
END;
$$;