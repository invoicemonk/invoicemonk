
CREATE OR REPLACE FUNCTION public.enforce_admin_only_flagging()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_flagged IS DISTINCT FROM OLD.is_flagged THEN
    IF NOT has_role(auth.uid(), 'platform_admin'::app_role) THEN
      RAISE EXCEPTION 'Only platform admins can manage business fraud flags';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_admin_only_flag_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.flag_reason IS DISTINCT FROM OLD.flag_reason THEN
    IF NOT has_role(auth.uid(), 'platform_admin'::app_role) THEN
      RAISE EXCEPTION 'Only platform admins can manage business fraud flag reason';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_admin_only_flag_reason ON public.business_sensitive_data;
CREATE TRIGGER trg_enforce_admin_only_flag_reason
BEFORE UPDATE ON public.business_sensitive_data
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_only_flag_reason();
