ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paid_through timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_through_reason text,
  ADD COLUMN IF NOT EXISTS paid_through_granted_by uuid,
  ADD COLUMN IF NOT EXISTS paid_through_granted_at timestamp with time zone;

COMMENT ON COLUMN public.subscriptions.paid_through IS
  'Durable prepaid coverage: entitlement must NOT be revoked by any automated path while now() < paid_through, regardless of Stripe state.';

CREATE OR REPLACE FUNCTION public.subscription_has_prepaid_coverage(_subscription_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT paid_through > now() FROM public.subscriptions WHERE id = _subscription_id),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.subscription_has_prepaid_coverage(uuid) TO authenticated, service_role;