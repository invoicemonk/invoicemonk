-- Security Hardening: Add caller validation to SECURITY DEFINER functions

-- Update close_account function to validate caller
CREATE OR REPLACE FUNCTION public.close_account(_user_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _retention_years INTEGER;
  _retention_date DATE;
  _caller_id UUID;
  _is_platform_admin BOOLEAN;
BEGIN
  -- Get the authenticated caller
  _caller_id := auth.uid();
  
  -- Check if caller is a platform admin
  _is_platform_admin := has_role(_caller_id, 'platform_admin');
  
  -- SECURITY: Only allow users to close their own account OR platform admins
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to close an account';
  END IF;
  
  IF _caller_id != _user_id AND NOT _is_platform_admin THEN
    RAISE EXCEPTION 'You can only close your own account';
  END IF;

  -- Set profile status to closed
  UPDATE public.profiles
  SET 
    account_status = 'closed',
    account_closed_at = now(),
    closed_by = _caller_id,
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
    jsonb_build_object('reason', _reason, 'closed_by', _caller_id, 'is_admin_action', _is_platform_admin)
  );
END;
$function$;

-- Update log_audit_event to validate inputs
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _event_type audit_event_type, 
  _entity_type text, 
  _entity_id uuid DEFAULT NULL::uuid, 
  _user_id uuid DEFAULT NULL::uuid, 
  _business_id uuid DEFAULT NULL::uuid, 
  _previous_state jsonb DEFAULT NULL::jsonb, 
  _new_state jsonb DEFAULT NULL::jsonb, 
  _metadata jsonb DEFAULT NULL::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _log_id UUID;
  _actor_role TEXT;
  _sanitized_entity_type TEXT;
BEGIN
  -- Validate entity_type (max 100 chars, alphanumeric and underscore only)
  IF _entity_type IS NULL OR LENGTH(_entity_type) = 0 THEN
    RAISE EXCEPTION 'entity_type is required';
  END IF;
  
  IF LENGTH(_entity_type) > 100 THEN
    RAISE EXCEPTION 'entity_type must be at most 100 characters';
  END IF;
  
  -- Sanitize entity_type (remove any potentially dangerous characters)
  _sanitized_entity_type := regexp_replace(_entity_type, '[^a-zA-Z0-9_-]', '', 'g');
  
  -- Get actor's role
  SELECT role::TEXT INTO _actor_role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  INSERT INTO public.audit_logs (
    event_type,
    entity_type,
    entity_id,
    actor_id,
    actor_role,
    user_id,
    business_id,
    previous_state,
    new_state,
    metadata,
    event_hash
  ) VALUES (
    _event_type,
    _sanitized_entity_type,
    _entity_id,
    auth.uid(),
    _actor_role,
    COALESCE(_user_id, auth.uid()),
    _business_id,
    _previous_state,
    _new_state,
    _metadata,
    encode(sha256(
      (_event_type::TEXT || _sanitized_entity_type || COALESCE(_entity_id::TEXT, '') || now()::TEXT)::BYTEA
    ), 'hex')
  )
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$function$;

-- Add comment documenting security measures
COMMENT ON FUNCTION public.close_account IS 'Closes a user account. Security: Only the account owner or platform admins can call this function.';
COMMENT ON FUNCTION public.log_audit_event IS 'Logs an audit event. Security: Validates and sanitizes entity_type input.';
COMMENT ON FUNCTION public.issue_invoice IS 'Issues an invoice. Security: Validates caller owns invoice via RLS on invoices table and checks email verification.';