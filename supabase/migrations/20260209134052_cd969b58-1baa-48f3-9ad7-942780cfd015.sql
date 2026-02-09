
-- A. Verification indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoices_verification_id ON invoices(verification_id) WHERE verification_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_verification_id ON receipts(verification_id);

-- B. Lightweight verification access log (auto-expiring, replaces audit_logs for public traffic)
CREATE TABLE public.verification_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  verification_id UUID NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

ALTER TABLE public.verification_access_logs ENABLE ROW LEVEL SECURITY;

-- No user-facing policies needed - only service role writes from edge functions
-- Platform admins can view for debugging
CREATE POLICY "Platform admins can view verification logs"
ON public.verification_access_logs
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE INDEX idx_verification_access_logs_accessed_at 
  ON verification_access_logs(accessed_at);

CREATE INDEX idx_verification_access_logs_entity 
  ON verification_access_logs(entity_type, entity_id);

-- C. Audit log JSONB size validation trigger (cap at 10KB per field)
CREATE OR REPLACE FUNCTION public.validate_audit_log_size()
RETURNS TRIGGER AS $$
BEGIN
  -- Truncate oversized JSONB fields to prevent bloat
  IF NEW.previous_state IS NOT NULL AND octet_length(NEW.previous_state::text) > 10240 THEN
    NEW.previous_state = jsonb_build_object('_truncated', true, '_original_size_bytes', octet_length(NEW.previous_state::text));
  END IF;
  IF NEW.new_state IS NOT NULL AND octet_length(NEW.new_state::text) > 10240 THEN
    NEW.new_state = jsonb_build_object('_truncated', true, '_original_size_bytes', octet_length(NEW.new_state::text));
  END IF;
  IF NEW.metadata IS NOT NULL AND octet_length(NEW.metadata::text) > 10240 THEN
    NEW.metadata = jsonb_build_object('_truncated', true, '_original_size_bytes', octet_length(NEW.metadata::text));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

CREATE TRIGGER validate_audit_log_size_trigger
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION validate_audit_log_size();

-- D. Storage bucket creation and limits
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('invoice-pdfs', 'invoice-pdfs', false, 2097152)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('receipt-pdfs', 'receipt-pdfs', false, 2097152)
ON CONFLICT (id) DO NOTHING;

-- RLS for invoice-pdfs bucket
CREATE POLICY "Business members can read invoice PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Service role can write invoice PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-pdfs');

-- RLS for receipt-pdfs bucket
CREATE POLICY "Business members can read receipt PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipt-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Service role can write receipt PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipt-pdfs');

-- Set file size limits on existing buckets
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'payment-proofs';
UPDATE storage.buckets SET file_size_limit = 1048576 WHERE id = 'business-logos';
