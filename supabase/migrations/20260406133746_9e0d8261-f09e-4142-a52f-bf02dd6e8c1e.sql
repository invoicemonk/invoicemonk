
-- 1. Fix create_default_business: remove the manual business_members insert
CREATE OR REPLACE FUNCTION public.create_default_business()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Owner membership is now handled exclusively by the
  -- add_business_creator_as_owner trigger on the businesses table.

  RETURN NEW;
END;
$$;

-- 2. Make add_business_creator_as_owner idempotent
CREATE OR REPLACE FUNCTION public.add_business_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_members (user_id, business_id, role, accepted_at)
  VALUES (NEW.created_by, NEW.id, 'owner', now())
  ON CONFLICT (user_id, business_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
