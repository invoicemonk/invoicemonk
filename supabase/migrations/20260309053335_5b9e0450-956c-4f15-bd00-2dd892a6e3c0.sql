-- Fix is_business_member to require accepted membership
CREATE OR REPLACE FUNCTION public.is_business_member(_user_id uuid, _business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id 
      AND business_id = _business_id
      AND accepted_at IS NOT NULL
  )
$function$;

-- Fix has_business_role to require accepted membership
CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _business_id uuid, _role business_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id 
      AND business_id = _business_id 
      AND role = _role
      AND accepted_at IS NOT NULL
  )
$function$;