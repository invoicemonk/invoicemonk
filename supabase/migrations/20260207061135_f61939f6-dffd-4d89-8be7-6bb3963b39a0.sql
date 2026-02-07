-- =========================================
-- RECEIPT SYSTEM DATABASE MIGRATION
-- Compliance-grade receipts as first-class financial artifacts
-- =========================================

-- 1. Add new audit event types for receipts
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'RECEIPT_ISSUED';
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'RECEIPT_VIEWED';
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'RECEIPT_EXPORTED';

-- 2. Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  
  receipt_hash TEXT NOT NULL,
  verification_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  
  issuer_snapshot JSONB NOT NULL,
  payer_snapshot JSONB NOT NULL,
  invoice_snapshot JSONB NOT NULL,
  payment_snapshot JSONB NOT NULL,
  
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retention_locked_until TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes for common queries
CREATE INDEX idx_receipts_business_id ON public.receipts(business_id);
CREATE INDEX idx_receipts_invoice_id ON public.receipts(invoice_id);
CREATE INDEX idx_receipts_payment_id ON public.receipts(payment_id);
CREATE INDEX idx_receipts_verification_id ON public.receipts(verification_id);
CREATE INDEX idx_receipts_issued_at ON public.receipts(issued_at);

-- 4. Create immutability trigger function
CREATE OR REPLACE FUNCTION public.prevent_receipt_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Receipts are immutable and cannot be modified or deleted.';
END;
$$;

-- 5. Apply immutability trigger
CREATE TRIGGER prevent_receipt_modification_trigger
BEFORE UPDATE OR DELETE ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_receipt_modification();

-- 6. Add next_receipt_number column to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS next_receipt_number INTEGER NOT NULL DEFAULT 1;

-- 7. Create receipt generation function (called from edge function via service role)
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
BEGIN
  -- 1. Get payment
  SELECT * INTO _payment FROM payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', _payment_id;
  END IF;

  -- 2. Check if receipt already exists for this payment
  IF EXISTS (SELECT 1 FROM receipts WHERE payment_id = _payment_id) THEN
    SELECT id INTO _receipt_id FROM receipts WHERE payment_id = _payment_id;
    RETURN _receipt_id;
  END IF;

  -- 3. Get invoice
  SELECT * INTO _invoice FROM invoices WHERE id = _payment.invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found for payment: %', _payment_id;
  END IF;

  -- 4. Get business
  SELECT * INTO _business FROM businesses WHERE id = _invoice.business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found for invoice: %', _invoice.id;
  END IF;

  -- 5. Get client
  SELECT * INTO _client FROM clients WHERE id = _invoice.client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found for invoice: %', _invoice.id;
  END IF;

  -- 6. Get retention policy
  SELECT * INTO _retention_policy 
  FROM retention_policies 
  WHERE jurisdiction = _business.jurisdiction 
    AND entity_type = 'invoice'
  ORDER BY created_at DESC
  LIMIT 1;
  
  _retention_years := COALESCE(_retention_policy.retention_years, 7);

  -- 7. Get next receipt number for business (atomic increment)
  UPDATE businesses 
  SET next_receipt_number = next_receipt_number + 1
  WHERE id = _business.id
  RETURNING next_receipt_number - 1 INTO _receipt_seq;

  -- 8. Generate receipt number using business invoice_prefix
  _receipt_number := 'RCP-' || COALESCE(_business.invoice_prefix, 'INV') || '-' || LPAD(_receipt_seq::TEXT, 3, '0');

  -- 9. Generate verification ID
  _verification_id := gen_random_uuid();

  -- 10. Set issued_at
  _issued_at := now();

  -- 11. Create issuer snapshot
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

  -- 12. Create payer snapshot
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

  -- 13. Create invoice snapshot
  _invoice_snapshot := jsonb_build_object(
    'invoice_number', _invoice.invoice_number,
    'total_amount', _invoice.total_amount,
    'issue_date', _invoice.issue_date,
    'due_date', _invoice.due_date,
    'currency', _invoice.currency
  );

  -- 14. Create payment snapshot
  _payment_snapshot := jsonb_build_object(
    'payment_method', _payment.payment_method,
    'payment_reference', _payment.payment_reference,
    'payment_date', _payment.payment_date,
    'notes', _payment.notes
  );

  -- 15. Generate SHA-256 hash
  _hash_input := _receipt_number || '|' || _invoice.id::TEXT || '|' || _payment_id::TEXT || '|' || 
                 _payment.amount::TEXT || '|' || _invoice.currency || '|' || _issued_at::TEXT;
  _receipt_hash := encode(sha256(_hash_input::bytea), 'hex');

  -- 16. Insert receipt
  INSERT INTO receipts (
    receipt_number,
    invoice_id,
    payment_id,
    business_id,
    amount,
    currency,
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
    _receipt_hash,
    _verification_id,
    _issuer_snapshot,
    _payer_snapshot,
    _invoice_snapshot,
    _payment_snapshot,
    _issued_at,
    (_issued_at + (_retention_years || ' years')::INTERVAL)::TIMESTAMPTZ
  )
  RETURNING id INTO _receipt_id;

  -- 17. Log audit event
  PERFORM log_audit_event(
    _event_type := 'RECEIPT_ISSUED'::audit_event_type,
    _entity_type := 'receipt',
    _entity_id := _receipt_id,
    _user_id := _payment.recorded_by,
    _business_id := _business.id,
    _previous_state := NULL,
    _new_state := jsonb_build_object(
      'receipt_number', _receipt_number,
      'amount', _payment.amount,
      'currency', _invoice.currency,
      'verification_id', _verification_id
    ),
    _metadata := jsonb_build_object(
      'invoice_id', _invoice.id,
      'payment_id', _payment_id,
      'invoice_number', _invoice.invoice_number
    )
  );

  RETURN _receipt_id;
END;
$$;

-- 8. Enable RLS on receipts table
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for receipts

-- Users can view receipts for businesses they are members of
CREATE POLICY "Business members can view receipts"
ON public.receipts FOR SELECT
USING (is_business_member(auth.uid(), business_id));

-- Platform admins can view all receipts
CREATE POLICY "Platform admins can view all receipts"
ON public.receipts FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- No INSERT policy for regular users - receipts created only via server function
-- Service role bypasses RLS for insertion

-- 10. Add retention policy entry for receipts
INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'NG', 'receipt', 6, 'Nigerian tax law requires 6-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'NG' AND entity_type = 'receipt');

INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'US', 'receipt', 7, 'IRS requires 7-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'US' AND entity_type = 'receipt');

INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'GB', 'receipt', 6, 'HMRC requires 6-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'GB' AND entity_type = 'receipt');

INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'DE', 'receipt', 10, 'German tax law requires 10-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'DE' AND entity_type = 'receipt');

INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'FR', 'receipt', 10, 'French tax law requires 10-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'FR' AND entity_type = 'receipt');

INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'AU', 'receipt', 7, 'Australian tax law requires 7-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'AU' AND entity_type = 'receipt');

INSERT INTO public.retention_policies (jurisdiction, entity_type, retention_years, legal_basis)
SELECT 'CA', 'receipt', 7, 'Canadian tax law requires 7-year retention for financial records'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CA' AND entity_type = 'receipt');