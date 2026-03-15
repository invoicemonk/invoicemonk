-- 1. Update create_default_business() to NOT set jurisdiction/default_currency
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
    name,
    business_type,
    registration_status,
    is_default,
    created_by
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Business'),
    'freelancer',
    'unregistered',
    true,
    NEW.id
  )
  RETURNING id INTO new_business_id;
  
  INSERT INTO public.subscriptions (
    business_id,
    tier,
    status,
    current_period_start
  ) VALUES (
    new_business_id,
    'starter',
    'active',
    NOW()
  );
  
  RETURN NEW;
END;
$function$;

-- 2. Update auto_create_default_currency_account() to skip when currency is NULL
CREATE OR REPLACE FUNCTION public.auto_create_default_currency_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.default_currency IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO currency_accounts (business_id, currency, is_default, name)
  VALUES (
    NEW.id,
    NEW.default_currency,
    true,
    NEW.default_currency || ' Account'
  );
  RETURN NEW;
END;
$function$;

-- 3. Remove default value from jurisdiction column
ALTER TABLE businesses ALTER COLUMN jurisdiction DROP DEFAULT;