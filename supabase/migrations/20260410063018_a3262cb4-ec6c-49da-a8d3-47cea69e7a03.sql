
-- 1. Revert Lucalvry LLC verification
UPDATE businesses
SET verification_status = 'unverified',
    verification_source = 'none',
    verified_at = NULL,
    verified_by = NULL,
    document_verification_status = 'not_uploaded',
    updated_at = now()
WHERE id = 'd310fca2-e168-44b9-b035-fee6413a6012';

-- 2. Update admin_set_verification with paid plan + completeness checks
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

  IF NOT has_role(_admin_id, 'platform_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform admins can set verification status';
  END IF;

  IF _status = 'verified' AND (_source IS NULL OR _source = 'none') THEN
    RAISE EXCEPTION 'Cannot set verified without a valid verification source';
  END IF;

  IF _status NOT IN ('unverified', 'self_declared', 'pending_review', 'verified', 'rejected', 'requires_action') THEN
    RAISE EXCEPTION 'Invalid verification status: %', _status;
  END IF;

  -- Gate: require paid plan for verification
  IF _status = 'verified' THEN
    IF NOT EXISTS (
      SELECT 1 FROM subscriptions
      WHERE business_id = _business_id
        AND status = 'active'
        AND tier != 'starter'
    ) THEN
      RAISE EXCEPTION 'Business must be on a paid plan to be verified';
    END IF;
  END IF;

  -- Gate: require complete business profile for verification
  IF _status = 'verified' THEN
    PERFORM 1 FROM businesses b
    WHERE b.id = _business_id
      AND b.name IS NOT NULL AND b.name != ''
      AND b.contact_email IS NOT NULL AND b.contact_email != ''
      AND b.jurisdiction IS NOT NULL AND b.jurisdiction != ''
      AND (b.entity_type = 'individual' OR (b.legal_name IS NOT NULL AND b.legal_name != ''))
      AND (b.entity_type = 'individual' OR (b.tax_id IS NOT NULL AND b.tax_id != ''));

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business profile is incomplete. Required fields must be filled before verification.';
    END IF;
  END IF;

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

  -- Sync individual verification document statuses
  IF _doc_status IN ('verified', 'rejected', 'requires_action') THEN
    UPDATE public.verification_documents
    SET
      status = CASE _doc_status
        WHEN 'verified' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'requires_action' THEN 'requires_action'
        ELSE status
      END,
      reviewed_by = _admin_id,
      reviewed_at = now(),
      review_notes = COALESCE(_notes, review_notes)
    WHERE business_id = _business_id
      AND status IN ('pending', 'pending_review');
  END IF;

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
