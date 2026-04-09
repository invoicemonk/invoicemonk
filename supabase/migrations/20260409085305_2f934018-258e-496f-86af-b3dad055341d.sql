
-- 1. Add verification columns to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_source text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_notes text;

-- Migrate existing business_identity_level data
UPDATE public.businesses
SET verification_status = CASE
  WHEN business_identity_level = 'verified' THEN 'verified'
  WHEN business_identity_level = 'self_declared' THEN 'self_declared'
  WHEN business_identity_level IN ('nrs_linked', 'regulator_linked') THEN 'verified'
  ELSE 'unverified'
END,
verification_source = CASE
  WHEN business_identity_level = 'verified' THEN 'manual_review'
  WHEN business_identity_level IN ('nrs_linked', 'regulator_linked') THEN 'government_api'
  ELSE 'none'
END
WHERE business_identity_level IS NOT NULL AND business_identity_level != 'unverified';

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_businesses_verification_status ON public.businesses(verification_status);

-- 2. Create verification_documents table
CREATE TABLE public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can upload verification documents"
  ON public.verification_documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = uploaded_by AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can view their verification documents"
  ON public.verification_documents FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage all verification documents"
  ON public.verification_documents FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- 3. Sensitive field change trigger
CREATE OR REPLACE FUNCTION public.on_sensitive_field_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only downgrade if currently verified
  IF OLD.verification_status = 'verified' THEN
    -- Check if sensitive fields changed
    IF (OLD.tax_id IS DISTINCT FROM NEW.tax_id)
       OR (OLD.legal_name IS DISTINCT FROM NEW.legal_name)
       OR (OLD.jurisdiction IS DISTINCT FROM NEW.jurisdiction) THEN
      NEW.verification_status := 'pending_review';
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sensitive_field_change
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.on_sensitive_field_change();

-- 4. Admin set verification RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_set_verification(
  _business_id uuid,
  _status text,
  _source text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
BEGIN
  _admin_id := auth.uid();

  -- Only platform admins can call this
  IF NOT has_role(_admin_id, 'platform_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform admins can set verification status';
  END IF;

  -- Cannot set verified without a valid source
  IF _status = 'verified' AND (_source IS NULL OR _source = 'none') THEN
    RAISE EXCEPTION 'Cannot set verified without a valid verification source';
  END IF;

  -- Validate status
  IF _status NOT IN ('unverified', 'self_declared', 'pending_review', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification status: %', _status;
  END IF;

  UPDATE public.businesses
  SET
    verification_status = _status,
    verification_source = COALESCE(_source, verification_source),
    verified_at = CASE WHEN _status = 'verified' THEN now() ELSE NULL END,
    verified_by = CASE WHEN _status = 'verified' THEN _admin_id ELSE NULL END,
    rejection_reason = CASE WHEN _status = 'rejected' THEN _reason ELSE NULL END,
    verification_notes = COALESCE(_notes, verification_notes),
    updated_at = now()
  WHERE id = _business_id;

  -- Audit log
  PERFORM log_audit_event(
    'BUSINESS_VERIFICATION_CHANGED'::audit_event_type,
    'business',
    _business_id,
    _business_id,
    jsonb_build_object(
      'new_status', _status,
      'source', _source,
      'reason', _reason,
      'admin_id', _admin_id
    )
  );
END;
$$;

-- 5. Storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Business members can upload verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Business members can view verification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-documents'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Platform admins can manage verification docs"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'verification-documents'
    AND has_role(auth.uid(), 'platform_admin'::app_role)
  );
