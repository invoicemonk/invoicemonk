
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

  -- Audit log (fixed: pass all 8 arguments)
  PERFORM log_audit_event(
    'BUSINESS_VERIFICATION_CHANGED'::audit_event_type,
    'business',
    _business_id,
    _admin_id,
    _business_id,
    NULL::jsonb,
    NULL::jsonb,
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
