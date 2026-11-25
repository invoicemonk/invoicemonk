ALTER TABLE public.profiles ALTER COLUMN has_selected_plan SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profile_plan_selection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.has_selected_plan IS DISTINCT FROM OLD.has_selected_plan
    AND COALESCE(auth.role(), '') <> 'service_role'
    AND NOT (
      auth.uid() IS NOT NULL
      AND public.has_role(auth.uid(), 'platform_admin')
    )
  THEN
    RAISE EXCEPTION 'Plan access can only be changed by trusted payment verification.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_plan_selection ON public.profiles;
CREATE TRIGGER guard_profile_plan_selection
BEFORE UPDATE OF has_selected_plan ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_plan_selection();

DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
CREATE POLICY "Authenticated users can create businesses"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.has_selected_plan = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND s.status = 'active'
        AND s.tier::text IN ('starter_paid', 'professional', 'business')
    )
  )
);