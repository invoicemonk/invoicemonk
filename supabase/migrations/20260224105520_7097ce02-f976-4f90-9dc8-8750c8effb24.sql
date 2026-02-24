
-- Drop existing trigger first to avoid conflict
DROP TRIGGER IF EXISTS trg_email_verified_lifecycle ON public.profiles;
DROP TRIGGER IF EXISTS trg_profile_created_lifecycle ON public.profiles;
DROP TRIGGER IF EXISTS trg_business_member_created_lifecycle ON public.business_members;

-- Step 1A: Add 5 new columns to user_activity_state
ALTER TABLE public.user_activity_state
  ADD COLUMN IF NOT EXISTS has_business BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_business_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_no_business_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_no_invoice_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_upgrade_cta_email_at TIMESTAMPTZ;

-- Step 1B: Profile created lifecycle trigger
CREATE OR REPLACE FUNCTION public.log_profile_created_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lifecycle_events (user_id, event_type, metadata)
  VALUES (NEW.id, 'registration_completed', '{}'::jsonb);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_created_lifecycle
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_created_lifecycle();

-- Step 1B: Email verified lifecycle trigger (replaces existing)
CREATE OR REPLACE FUNCTION public.log_email_verified_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_verified IS DISTINCT FROM NEW.email_verified
     AND NEW.email_verified = true THEN
    UPDATE public.user_activity_state
    SET email_verified = true, updated_at = now()
    WHERE user_id = NEW.id;

    INSERT INTO public.lifecycle_events (user_id, event_type, metadata)
    VALUES (NEW.id, 'email_verified', '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_verified_lifecycle
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_email_verified_lifecycle();

-- Step 1B: Business member created lifecycle trigger
CREATE OR REPLACE FUNCTION public.log_business_member_created_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_activity_state
  SET has_business = true,
      last_business_created_at = now(),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  INSERT INTO public.lifecycle_events (user_id, event_type, metadata)
  VALUES (NEW.user_id, 'business_profile_created', jsonb_build_object('business_id', NEW.business_id));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_member_created_lifecycle
  AFTER INSERT ON public.business_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_business_member_created_lifecycle();

-- Step 1C: Partial indexes
CREATE INDEX IF NOT EXISTS idx_uas_no_business
  ON public.user_activity_state (email_verified, has_business)
  WHERE email_verified = true AND has_business = false;

CREATE INDEX IF NOT EXISTS idx_uas_no_invoice
  ON public.user_activity_state (has_business, total_invoices)
  WHERE has_business = true AND total_invoices = 0;

CREATE INDEX IF NOT EXISTS idx_uas_upgrade_cta
  ON public.user_activity_state (total_invoices)
  WHERE total_invoices >= 2;

-- Step 1D: Backfill existing data
UPDATE public.user_activity_state uas
SET has_business = true,
    last_business_created_at = bm.first_created
FROM (
  SELECT DISTINCT ON (user_id) user_id, created_at AS first_created
  FROM public.business_members
  ORDER BY user_id, created_at ASC
) bm
WHERE uas.user_id = bm.user_id
  AND uas.has_business = false;

-- RLS: Allow users to insert their own lifecycle events
CREATE POLICY "Users can insert their own lifecycle events"
  ON public.lifecycle_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
