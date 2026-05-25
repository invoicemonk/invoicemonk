
-- Persisted "paid plan intent" so a failed Stripe checkout doesn't silently downgrade users.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intended_tier text,
  ADD COLUMN IF NOT EXISTS intended_billing_period text,
  ADD COLUMN IF NOT EXISTS intended_tier_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_checkout_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_checkout_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_intended_tier_check
    CHECK (intended_tier IS NULL OR intended_tier IN ('professional','business'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_intended_billing_check
    CHECK (intended_billing_period IS NULL OR intended_billing_period IN ('monthly','yearly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper RPC: how many users picked a paid plan but ended up on starter in the last N days.
CREATE OR REPLACE FUNCTION public.admin_paid_intent_lost_count(days integer DEFAULT 7)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.profiles p
  WHERE p.last_failed_checkout_at IS NOT NULL
    AND p.last_failed_checkout_at >= now() - (days || ' days')::interval
    AND p.failed_checkout_attempts >= 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.business_members bm
      JOIN public.subscriptions s ON s.business_id = bm.business_id
      WHERE bm.user_id = p.id
        AND s.tier IN ('professional','business')
        AND s.status IN ('active','trialing','past_due')
    );
$$;

REVOKE ALL ON FUNCTION public.admin_paid_intent_lost_count(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_paid_intent_lost_count(integer) TO authenticated;
