-- Create ban_user function
CREATE OR REPLACE FUNCTION public.ban_user(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Permission denied: Only platform admins can ban users.';
  END IF;

  IF length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'Reason must be at least 10 characters long.';
  END IF;

  UPDATE public.profiles
  SET
    account_status = 'suspended',
    closure_reason = _reason,
    closed_by = auth.uid(),
    account_closed_at = now()
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, user_id, event_type, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'platform_admin',
    _user_id,
    'user.suspended',
    'profile',
    _user_id,
    jsonb_build_object('reason', _reason)
  );
END;
$$;

-- Create unban_user function
CREATE OR REPLACE FUNCTION public.unban_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Permission denied: Only platform admins can unban users.';
  END IF;

  UPDATE public.profiles
  SET
    account_status = 'active',
    closure_reason = NULL,
    closed_by = NULL,
    account_closed_at = NULL
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, user_id, event_type, entity_type, entity_id)
  VALUES (
    auth.uid(),
    'platform_admin',
    _user_id,
    'user.reactivated',
    'profile',
    _user_id
  );
END;
$$;

-- Allow platform admins to update profiles
CREATE POLICY "Platform admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));