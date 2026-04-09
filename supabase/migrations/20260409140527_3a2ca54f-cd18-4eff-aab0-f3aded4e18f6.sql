
-- 1. Add verification_submitted_at to businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS verification_submitted_at timestamp with time zone;

-- 2. Add file_path to verification_documents
ALTER TABLE public.verification_documents
ADD COLUMN IF NOT EXISTS file_path text;

-- 3. Update admin_set_verification to support requires_action and sync document_verification_status
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
  _doc_status text;
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

  -- Validate status (now includes requires_action)
  IF _status NOT IN ('unverified', 'self_declared', 'pending_review', 'verified', 'rejected', 'requires_action') THEN
    RAISE EXCEPTION 'Invalid verification status: %', _status;
  END IF;

  -- Map verification_status to document_verification_status
  _doc_status := CASE _status
    WHEN 'verified' THEN 'verified'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'requires_action' THEN 'requires_action'
    WHEN 'pending_review' THEN 'pending_review'
    ELSE 'not_uploaded'
  END;

  UPDATE public.businesses
  SET
    verification_status = _status,
    verification_source = CASE
      WHEN _status = 'verified' THEN COALESCE(_source, verification_source)
      ELSE verification_source
    END,
    document_verification_status = _doc_status,
    verified_at = CASE WHEN _status = 'verified' THEN now() ELSE NULL END,
    verified_by = CASE WHEN _status = 'verified' THEN _admin_id ELSE NULL END,
    rejection_reason = CASE WHEN _status = 'rejected' THEN _reason ELSE NULL END,
    verification_notes = CASE
      WHEN _status IN ('rejected', 'requires_action') THEN _notes
      WHEN _notes IS NOT NULL THEN _notes
      ELSE verification_notes
    END,
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
      'doc_status', _doc_status,
      'source', _source,
      'reason', _reason,
      'notes', _notes,
      'admin_id', _admin_id
    )
  );
END;
$$;

-- 4. Create admin_get_verification_queue RPC
CREATE OR REPLACE FUNCTION public.admin_get_verification_queue(
  _status_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  legal_name text,
  entity_type text,
  verification_status text,
  document_verification_status text,
  verification_submitted_at timestamptz,
  verification_notes text,
  rejection_reason text,
  jurisdiction text,
  created_at timestamptz,
  document_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'platform_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform admins can access verification queue';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.legal_name,
    b.entity_type,
    b.verification_status,
    b.document_verification_status,
    b.verification_submitted_at,
    b.verification_notes,
    b.rejection_reason,
    b.jurisdiction,
    b.created_at,
    COALESCE(d.doc_count, 0) AS document_count
  FROM public.businesses b
  LEFT JOIN (
    SELECT vd.business_id, COUNT(*) AS doc_count
    FROM public.verification_documents vd
    GROUP BY vd.business_id
  ) d ON d.business_id = b.id
  WHERE b.verification_status IN ('pending_review', 'requires_action', 'verified', 'rejected')
    AND (_status_filter IS NULL OR b.verification_status = _status_filter)
  ORDER BY
    CASE b.verification_status
      WHEN 'pending_review' THEN 1
      WHEN 'requires_action' THEN 2
      WHEN 'rejected' THEN 3
      WHEN 'verified' THEN 4
    END,
    b.verification_submitted_at DESC NULLS LAST,
    b.updated_at DESC;
END;
$$;

-- 5. Create admin_get_business_documents RPC
CREATE OR REPLACE FUNCTION public.admin_get_business_documents(
  _business_id uuid
)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  uploaded_by uuid,
  document_type text,
  file_url text,
  file_path text,
  file_name text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'platform_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform admins can access business documents';
  END IF;

  RETURN QUERY
  SELECT
    vd.id,
    vd.business_id,
    vd.uploaded_by,
    vd.document_type,
    vd.file_url,
    vd.file_path,
    vd.file_name,
    vd.status,
    vd.reviewed_by,
    vd.reviewed_at,
    vd.review_notes,
    vd.created_at
  FROM public.verification_documents vd
  WHERE vd.business_id = _business_id
  ORDER BY vd.created_at DESC;
END;
$$;
