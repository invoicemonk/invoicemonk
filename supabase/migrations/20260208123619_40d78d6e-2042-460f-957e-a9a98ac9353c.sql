
-- 1. Add BUSINESS_DELETED to audit_event_type enum
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'BUSINESS_DELETED';

-- 2. Create delete_empty_business function
CREATE OR REPLACE FUNCTION public.delete_empty_business(_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _caller_id uuid;
  _is_owner boolean;
  _is_default boolean;
  _invoice_count integer;
  _credit_note_count integer;
  _receipt_count integer;
  _business_name text;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check ownership
  SELECT has_business_role(_caller_id, _business_id, 'owner') INTO _is_owner;
  IF NOT _is_owner THEN
    RAISE EXCEPTION 'Only the business owner can delete a business';
  END IF;

  -- Check if default
  SELECT COALESCE(is_default, false), name INTO _is_default, _business_name
  FROM businesses WHERE id = _business_id;

  IF _is_default THEN
    RAISE EXCEPTION 'Your default business cannot be deleted. Switch your default first.';
  END IF;

  -- Count invoices (any status)
  SELECT COUNT(*) INTO _invoice_count
  FROM invoices WHERE business_id = _business_id;

  IF _invoice_count > 0 THEN
    RAISE EXCEPTION 'This business has % invoice(s) and cannot be deleted. Void or resolve all invoices first.', _invoice_count;
  END IF;

  -- Count credit notes
  SELECT COUNT(*) INTO _credit_note_count
  FROM credit_notes WHERE business_id = _business_id;

  IF _credit_note_count > 0 THEN
    RAISE EXCEPTION 'This business has % credit note(s) and cannot be deleted.', _credit_note_count;
  END IF;

  -- Count receipts
  SELECT COUNT(*) INTO _receipt_count
  FROM receipts WHERE business_id = _business_id;

  IF _receipt_count > 0 THEN
    RAISE EXCEPTION 'This business has % receipt(s) and cannot be deleted.', _receipt_count;
  END IF;

  -- Log audit event BEFORE deletion (business still exists)
  PERFORM log_audit_event(
    _event_type := 'BUSINESS_DELETED'::audit_event_type,
    _entity_type := 'business',
    _entity_id := _business_id,
    _user_id := _caller_id,
    _business_id := _business_id,
    _previous_state := (SELECT row_to_json(b)::jsonb FROM businesses b WHERE b.id = _business_id),
    _new_state := NULL,
    _metadata := jsonb_build_object('business_name', _business_name)
  );

  -- Delete the business (CASCADE handles members, clients, subscriptions, notifications, expenses)
  DELETE FROM businesses WHERE id = _business_id;
END;
$$;

-- 3. Add DELETE RLS policy for business owners
CREATE POLICY "Business owners can delete their own businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (public.has_business_role(auth.uid(), id, 'owner'));
