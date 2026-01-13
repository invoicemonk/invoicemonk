-- ============================================
-- Phase E: Legal Identity Snapshotting
-- ============================================

-- Add snapshot fields to invoices for legal identity preservation
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issuer_snapshot JSONB;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB;

-- ============================================
-- Phase B: Tax Schema Versioning
-- ============================================

-- Create tax_schemas table
CREATE TABLE IF NOT EXISTS public.tax_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  rates JSONB NOT NULL,
  rules JSONB,
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(jurisdiction, version)
);

-- Enable RLS on tax_schemas
ALTER TABLE public.tax_schemas ENABLE ROW LEVEL SECURITY;

-- Tax schemas are readable by all authenticated users
CREATE POLICY "Authenticated users can view tax schemas"
  ON public.tax_schemas FOR SELECT
  TO authenticated
  USING (true);

-- Only platform admins can manage tax schemas
CREATE POLICY "Platform admins can manage tax schemas"
  ON public.tax_schemas FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));

-- Add tax schema binding to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_schema_id UUID REFERENCES public.tax_schemas(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_schema_version TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_schema_snapshot JSONB;

-- Seed initial tax schemas for supported jurisdictions
INSERT INTO public.tax_schemas (jurisdiction, version, name, rates, effective_from)
VALUES 
  ('NG', '2024.1', 'Nigeria VAT Standard', '{"vat": 7.5, "withholding": 5}', '2024-01-01'),
  ('US', '2024.1', 'US Sales Tax', '{"sales_tax_default": 0, "state_varies": true}', '2024-01-01'),
  ('GB', '2024.1', 'UK VAT Standard', '{"vat_standard": 20, "vat_reduced": 5, "vat_zero": 0}', '2024-01-01'),
  ('CA', '2024.1', 'Canada GST/HST', '{"gst": 5, "hst_varies": true}', '2024-01-01'),
  ('AU', '2024.1', 'Australia GST', '{"gst": 10}', '2024-01-01'),
  ('DE', '2024.1', 'Germany USt', '{"ust_standard": 19, "ust_reduced": 7}', '2024-01-01'),
  ('FR', '2024.1', 'France TVA', '{"tva_standard": 20, "tva_reduced": 10, "tva_super_reduced": 5.5}', '2024-01-01'),
  ('ZA', '2024.1', 'South Africa VAT', '{"vat": 15}', '2024-01-01'),
  ('KE', '2024.1', 'Kenya VAT', '{"vat": 16}', '2024-01-01'),
  ('GH', '2024.1', 'Ghana VAT', '{"vat": 15, "nhil": 2.5, "getfund": 2.5}', '2024-01-01')
ON CONFLICT (jurisdiction, version) DO NOTHING;

-- ============================================
-- Phase A: Record Retention & Preservation
-- ============================================

-- Add retention fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'closed'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_closed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closure_reason TEXT;

-- Create retention_policies table
CREATE TABLE IF NOT EXISTS public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'NG',
  retention_years INTEGER NOT NULL DEFAULT 7,
  legal_basis TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, jurisdiction)
);

-- Enable RLS on retention_policies
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

-- Retention policies readable by authenticated users
CREATE POLICY "Authenticated users can view retention policies"
  ON public.retention_policies FOR SELECT
  TO authenticated
  USING (true);

-- Only platform admins can manage retention policies
CREATE POLICY "Platform admins can manage retention policies"
  ON public.retention_policies FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));

-- Seed default retention policies
INSERT INTO public.retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
VALUES 
  ('invoice', 'NG', 7, 'FIRS Tax Regulations - 6 years minimum + 1 year buffer'),
  ('payment', 'NG', 7, 'FIRS Tax Regulations'),
  ('audit_log', 'NG', 10, 'Corporate compliance best practice'),
  ('credit_note', 'NG', 7, 'FIRS Tax Regulations'),
  ('invoice', 'US', 7, 'IRS Guidelines - 7 years'),
  ('invoice', 'GB', 6, 'HMRC VAT regulations - 6 years'),
  ('invoice', 'CA', 7, 'CRA requirements - 6 years + 1 buffer'),
  ('invoice', 'AU', 7, 'ATO requirements - 5 years + buffer'),
  ('invoice', 'DE', 10, 'German tax law - 10 years'),
  ('invoice', 'FR', 10, 'French tax law - 10 years')
ON CONFLICT (entity_type, jurisdiction) DO NOTHING;

-- Add retention lock fields to financial tables
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS retention_locked_until DATE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS retention_locked_until DATE;
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS retention_locked_until DATE;

-- Add ACCOUNT_CLOSED to audit_event_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ACCOUNT_CLOSED' AND enumtypid = 'public.audit_event_type'::regtype) THEN
    ALTER TYPE public.audit_event_type ADD VALUE 'ACCOUNT_CLOSED';
  END IF;
END$$;

-- Create close_account function
CREATE OR REPLACE FUNCTION public.close_account(_user_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _retention_years INTEGER;
  _retention_date DATE;
  _business_id UUID;
BEGIN
  -- Set profile status to closed
  UPDATE public.profiles
  SET 
    account_status = 'closed',
    account_closed_at = now(),
    closed_by = auth.uid(),
    closure_reason = _reason
  WHERE id = _user_id;

  -- Get default retention years (use NG as default)
  SELECT COALESCE(MAX(retention_years), 7) INTO _retention_years
  FROM public.retention_policies
  WHERE entity_type = 'invoice';

  _retention_date := CURRENT_DATE + (_retention_years * INTERVAL '1 year');

  -- Set retention lock on all user's invoices
  UPDATE public.invoices
  SET retention_locked_until = _retention_date
  WHERE user_id = _user_id AND retention_locked_until IS NULL;

  -- Set retention lock on payments for user's invoices
  UPDATE public.payments p
  SET retention_locked_until = _retention_date
  FROM public.invoices i
  WHERE p.invoice_id = i.id AND i.user_id = _user_id AND p.retention_locked_until IS NULL;

  -- Set retention lock on credit notes
  UPDATE public.credit_notes
  SET retention_locked_until = _retention_date
  WHERE user_id = _user_id AND retention_locked_until IS NULL;

  -- Log the account closure
  PERFORM public.log_audit_event(
    'ACCOUNT_CLOSED'::audit_event_type,
    'user',
    _user_id,
    _user_id,
    NULL,
    NULL,
    jsonb_build_object('account_status', 'closed', 'retention_locked_until', _retention_date),
    jsonb_build_object('reason', _reason, 'closed_by', auth.uid())
  );
END;
$$;

-- Create trigger to prevent financial record deletion
CREATE OR REPLACE FUNCTION public.prevent_financial_record_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow deletion of draft invoices only
  IF TG_TABLE_NAME = 'invoices' AND OLD.status = 'draft' THEN
    RETURN OLD;
  END IF;
  
  -- Block all other deletions
  RAISE EXCEPTION 'Cannot delete % records. Financial records are immutable for compliance.', TG_TABLE_NAME;
END;
$$;

-- Apply deletion prevention triggers (drop if exists first to avoid errors)
DROP TRIGGER IF EXISTS prevent_payments_deletion ON public.payments;
CREATE TRIGGER prevent_payments_deletion
  BEFORE DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_financial_record_deletion();

DROP TRIGGER IF EXISTS prevent_credit_notes_deletion ON public.credit_notes;
CREATE TRIGGER prevent_credit_notes_deletion
  BEFORE DELETE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_financial_record_deletion();

-- ============================================
-- Phase C: Export Attestation & Chain of Custody
-- ============================================

-- Create export_manifests table
CREATE TABLE IF NOT EXISTS public.export_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL,
  actor_id UUID NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT,
  business_id UUID,
  scope JSONB NOT NULL,
  record_count INTEGER NOT NULL,
  integrity_hash TEXT NOT NULL,
  format TEXT NOT NULL,
  timestamp_utc TIMESTAMPTZ DEFAULT now(),
  source_ip INET,
  user_agent TEXT
);

-- Enable RLS on export_manifests
ALTER TABLE public.export_manifests ENABLE ROW LEVEL SECURITY;

-- Users can view their own exports
CREATE POLICY "Users can view their own exports"
  ON public.export_manifests FOR SELECT
  USING (actor_id = auth.uid());

-- Platform admins can view all exports
CREATE POLICY "Platform admins can view all exports"
  ON public.export_manifests FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

-- Authenticated users can insert exports
CREATE POLICY "Authenticated users can insert exports"
  ON public.export_manifests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND actor_id = auth.uid());

-- NO UPDATE/DELETE on export_manifests (immutable)

-- ============================================
-- Phase D: Admin Power Boundaries (DB-Enforced)
-- ============================================

-- Prevent platform admin INSERT on invoices
CREATE POLICY "Platform admins cannot insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (NOT has_role(auth.uid(), 'platform_admin'));

-- Prevent platform admin UPDATE on invoices (for non-draft)
-- Note: The existing update policy already restricts to draft only
-- We add explicit admin restriction
CREATE POLICY "Platform admins cannot update invoices"
  ON public.invoices FOR UPDATE
  USING (NOT has_role(auth.uid(), 'platform_admin'));

-- Prevent platform admin INSERT on payments
CREATE POLICY "Platform admins cannot insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (NOT has_role(auth.uid(), 'platform_admin'));

-- Prevent platform admin INSERT on credit_notes
CREATE POLICY "Platform admins cannot insert credit_notes"
  ON public.credit_notes FOR INSERT
  WITH CHECK (NOT has_role(auth.uid(), 'platform_admin'));

-- ============================================
-- Update issue_invoice function with snapshots
-- ============================================

CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id UUID)
RETURNS invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice public.invoices;
  _invoice_hash TEXT;
  _verification_id UUID;
  _issuer_snapshot JSONB;
  _recipient_snapshot JSONB;
  _tax_schema_record RECORD;
BEGIN
  -- Get invoice
  SELECT * INTO _invoice FROM public.invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;

  -- Snapshot issuer (business)
  SELECT jsonb_build_object(
    'legal_name', b.legal_name,
    'name', b.name,
    'tax_id', b.tax_id,
    'address', b.address,
    'jurisdiction', b.jurisdiction,
    'contact_email', b.contact_email,
    'contact_phone', b.contact_phone
  ) INTO _issuer_snapshot
  FROM public.businesses b
  WHERE b.id = _invoice.business_id;

  -- Snapshot recipient (client)
  SELECT jsonb_build_object(
    'name', c.name,
    'email', c.email,
    'tax_id', c.tax_id,
    'address', c.address,
    'phone', c.phone
  ) INTO _recipient_snapshot
  FROM public.clients c
  WHERE c.id = _invoice.client_id;

  -- Get current active tax schema for the business's jurisdiction
  SELECT ts.id, ts.version, to_jsonb(ts) AS snapshot
  INTO _tax_schema_record
  FROM public.tax_schemas ts
  JOIN public.businesses b ON b.jurisdiction = ts.jurisdiction
  WHERE b.id = _invoice.business_id
    AND ts.is_active = true
    AND ts.effective_from <= CURRENT_DATE
    AND (ts.effective_until IS NULL OR ts.effective_until >= CURRENT_DATE)
  ORDER BY ts.effective_from DESC
  LIMIT 1;
  
  -- Generate hash for tamper detection
  _invoice_hash := encode(sha256(
    (_invoice.id::TEXT || 
     _invoice.invoice_number || 
     _invoice.total_amount::TEXT || 
     _invoice.client_id::TEXT ||
     COALESCE(_issuer_snapshot::TEXT, '') ||
     COALESCE(_recipient_snapshot::TEXT, '') ||
     now()::TEXT)::BYTEA
  ), 'hex');
  
  _verification_id := gen_random_uuid();
  
  -- Update invoice to issued with all snapshots
  UPDATE public.invoices
  SET 
    status = 'issued',
    issued_at = now(),
    issued_by = auth.uid(),
    issue_date = COALESCE(issue_date, CURRENT_DATE),
    invoice_hash = _invoice_hash,
    verification_id = _verification_id,
    issuer_snapshot = _issuer_snapshot,
    recipient_snapshot = _recipient_snapshot,
    tax_schema_id = _tax_schema_record.id,
    tax_schema_version = _tax_schema_record.version,
    tax_schema_snapshot = _tax_schema_record.snapshot
  WHERE id = _invoice_id
  RETURNING * INTO _invoice;
  
  -- Log audit event
  PERFORM public.log_audit_event(
    'INVOICE_ISSUED'::audit_event_type,
    'invoice',
    _invoice_id,
    _invoice.user_id,
    _invoice.business_id,
    NULL,
    to_jsonb(_invoice),
    jsonb_build_object(
      'verification_id', _verification_id,
      'issuer_snapshot', _issuer_snapshot,
      'recipient_snapshot', _recipient_snapshot,
      'tax_schema_version', _tax_schema_record.version
    )
  );
  
  RETURN _invoice;
END;
$$;