-- Drop the old constraint that enforces XOR between user_id and business_id
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscription_owner_check;

-- Add new constraint that requires at least one of user_id or business_id
-- This allows business-level subscriptions while maintaining backward compatibility
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscription_owner_check 
  CHECK (user_id IS NOT NULL OR business_id IS NOT NULL);

-- Add is_default column to businesses if not exists
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Add registration_status column to businesses if not exists
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS registration_status text DEFAULT 'unregistered';

-- Add check constraint for registration_status
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_registration_status_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_registration_status_check 
  CHECK (registration_status IN ('unregistered', 'registered', 'pending'));

-- Create or replace the trigger function to auto-create default business on signup
CREATE OR REPLACE FUNCTION public.create_default_business()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  new_business_id uuid;
BEGIN
  -- Create default "Individual" business for new user
  INSERT INTO public.businesses (
    name,
    business_type,
    registration_status,
    is_default,
    created_by,
    jurisdiction,
    default_currency
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Business'),
    'freelancer',
    'unregistered',
    true,
    NEW.id,
    'NG',
    'NGN'
  )
  RETURNING id INTO new_business_id;
  
  -- Note: add_business_creator_as_owner trigger will auto-add user as owner
  
  -- Create default subscription for this business (business-level only)
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
$$;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_default_business ON auth.users;

-- Create trigger on auth.users to auto-create default business on signup
CREATE TRIGGER on_auth_user_created_default_business
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_business();

-- Remove the old user-level subscription trigger from profiles table
DROP TRIGGER IF EXISTS on_profile_created_subscription ON public.profiles;

-- Migrate existing users without a default business
-- First, create default businesses for users who don't have any business membership
INSERT INTO public.businesses (name, business_type, registration_status, is_default, created_by, jurisdiction, default_currency)
SELECT 
  COALESCE(p.full_name, 'My Business'),
  'freelancer',
  'unregistered',
  true,
  p.id,
  'NG',
  'NGN'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM business_members bm WHERE bm.user_id = p.id
);

-- For users who already have businesses, mark their first business as default if none is marked
UPDATE public.businesses b
SET is_default = true
WHERE b.id IN (
  SELECT DISTINCT ON (bm.user_id) b2.id
  FROM businesses b2
  JOIN business_members bm ON bm.business_id = b2.id AND bm.role = 'owner'
  WHERE NOT EXISTS (
    SELECT 1 FROM businesses b3 
    JOIN business_members bm2 ON bm2.business_id = b3.id 
    WHERE bm2.user_id = bm.user_id AND b3.is_default = true
  )
  ORDER BY bm.user_id, b2.created_at ASC
);

-- Link user-level subscriptions to their default business (keep user_id for now)
UPDATE subscriptions s
SET business_id = (
  SELECT b.id 
  FROM businesses b 
  WHERE b.created_by = s.user_id AND b.is_default = true
  LIMIT 1
)
WHERE s.business_id IS NULL 
AND s.user_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM businesses b WHERE b.created_by = s.user_id AND b.is_default = true
);