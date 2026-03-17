-- Add fraud flagging columns to businesses table
ALTER TABLE public.businesses
  ADD COLUMN is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN flag_reason text;

-- Trigger to ensure only platform admins can set is_flagged = true
CREATE OR REPLACE FUNCTION public.enforce_admin_only_flagging()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_flagged IS DISTINCT FROM OLD.is_flagged) OR (NEW.flag_reason IS DISTINCT FROM OLD.flag_reason AND NEW.is_flagged = true) THEN
    IF NOT has_role(auth.uid(), 'platform_admin'::app_role) THEN
      RAISE EXCEPTION 'Only platform admins can manage business fraud flags';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_admin_only_flagging_trigger
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_only_flagging();