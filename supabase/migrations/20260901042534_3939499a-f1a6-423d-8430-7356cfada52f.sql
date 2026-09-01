CREATE OR REPLACE FUNCTION public.notify_admin_paid_downgrade(
  _subscription_id uuid,
  _business_name text,
  _previous_tier text,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin RECORD;
BEGIN
  FOR _admin IN SELECT user_id FROM public.get_platform_admin_emails()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, business_id)
    VALUES (
      _admin.user_id,
      'ADMIN_PAID_DOWNGRADE',
      'Paying customer downgraded',
      COALESCE(_business_name, 'A business') || ' was downgraded from ' ||
        COALESCE(_previous_tier, 'a paid plan') || ' to starter. Reason: ' ||
        COALESCE(_reason, 'unspecified'),
      'subscription',
      _subscription_id,
      NULL
    );
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_admin_paid_downgrade(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admin_paid_downgrade(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admin_paid_downgrade(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admin_paid_downgrade(uuid, text, text, text) TO service_role;