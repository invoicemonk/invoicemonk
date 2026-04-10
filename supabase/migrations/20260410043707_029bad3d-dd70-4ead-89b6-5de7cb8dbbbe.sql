ALTER TABLE public.businesses DROP CONSTRAINT valid_doc_verification_status;
ALTER TABLE public.businesses ADD CONSTRAINT valid_doc_verification_status
  CHECK (document_verification_status = ANY (ARRAY[
    'not_uploaded'::text,
    'pending_review'::text,
    'verified'::text,
    'rejected'::text,
    'requires_action'::text
  ]));