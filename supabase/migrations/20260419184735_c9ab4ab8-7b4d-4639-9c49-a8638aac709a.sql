DROP FUNCTION IF EXISTS public.admin_get_verification_queue(text);

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
  document_count bigint,
  government_id_type text,
  government_id_value text
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
    COALESCE(d.doc_count, 0) AS document_count,
    b.government_id_type,
    b.government_id_value
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
    b.created_at DESC;
END;
$$;