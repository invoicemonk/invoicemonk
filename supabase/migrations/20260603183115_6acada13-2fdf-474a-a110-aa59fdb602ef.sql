-- 1. Stop auto-creating a starter subscription on signup
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Free Starter plan has been retired. New users have no subscription
  -- until they complete checkout for a paid plan.
  RETURN NEW;
END;
$$;

-- 2. Add grace-period column for existing free-tier users
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS starter_grace_expires_at timestamptz;

-- 3. Backfill 14-day grace window for everyone currently on starter/starter_paid
UPDATE public.subscriptions
SET starter_grace_expires_at = NOW() + INTERVAL '14 days'
WHERE tier IN ('starter', 'starter_paid')
  AND status = 'active'
  AND starter_grace_expires_at IS NULL;