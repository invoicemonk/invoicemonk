CREATE OR REPLACE FUNCTION public.provision_starter_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_subscription_id uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.created_by)
  THEN
    RAISE EXCEPTION 'Workspace subscription provisioning requires the authenticated creator.'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.id
  INTO paid_subscription_id
  FROM public.subscriptions s
  WHERE s.user_id = NEW.created_by
    AND s.business_id IS NULL
    AND s.status = 'active'
    AND s.tier::text IN ('starter_paid', 'professional', 'business')
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF paid_subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET business_id = NEW.id,
        updated_at = now()
    WHERE id = paid_subscription_id;
  ELSE
    INSERT INTO public.subscriptions (business_id, user_id, tier, status)
    VALUES (NEW.id, NEW.created_by, 'starter', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;