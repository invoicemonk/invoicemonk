-- Create function to sync email verification status
CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When email_confirmed_at is set or updated, sync to profiles
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.profiles 
    SET email_verified = TRUE, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for updates
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_email_verified();

-- Also handle case where user is created with email already confirmed
CREATE TRIGGER on_user_created_verified
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.sync_email_verified();

-- Fix existing users who have verified emails but profiles show unverified
UPDATE public.profiles p
SET email_verified = TRUE, updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id 
  AND u.email_confirmed_at IS NOT NULL 
  AND (p.email_verified = FALSE OR p.email_verified IS NULL);