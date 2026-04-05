
CREATE OR REPLACE FUNCTION public.create_default_business()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE 
  new_business_id uuid;
BEGIN
  INSERT INTO public.businesses (
    name, business_type, registration_status, is_default, created_by
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Business'),
    'freelancer', 'unregistered', true, NEW.id
  )
  RETURNING id INTO new_business_id;

  INSERT INTO public.business_members (business_id, user_id, role, accepted_at)
  VALUES (new_business_id, NEW.id, 'owner', NOW());

  -- No longer auto-create a starter subscription here.
  -- The user will choose their plan on /select-plan.

  RETURN NEW;
END;
$function$;
