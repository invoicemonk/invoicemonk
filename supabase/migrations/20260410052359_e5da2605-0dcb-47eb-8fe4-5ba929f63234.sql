
-- Add unique constraint for (business_id, email) where email is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_business_email_unique 
ON public.clients (business_id, lower(email)) 
WHERE email IS NOT NULL AND email != '';

-- Create validation trigger function
CREATE OR REPLACE FUNCTION public.validate_client_before_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Trim whitespace
  NEW.name := btrim(NEW.name);
  NEW.email := btrim(NEW.email);

  -- Enforce name minimum length
  IF length(NEW.name) < 2 THEN
    RAISE EXCEPTION 'Client name must be at least 2 characters' USING ERRCODE = 'check_violation';
  END IF;

  -- Validate email format if provided
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    IF NEW.email !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_client_before_save ON public.clients;
CREATE TRIGGER validate_client_before_save
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_client_before_save();
