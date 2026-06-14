-- Backfill: reset has_selected_plan for any user who has NO live subscription
-- (active/trialing/past_due) on themselves or any business they belong to.
-- Cleans up users who slipped past the legacy /checkout/success bug.
UPDATE public.profiles p
SET
  has_selected_plan = false,
  intended_tier = NULL,
  intended_billing_period = NULL,
  intended_tier_set_at = NULL
WHERE p.has_selected_plan = true
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.id
      AND s.status IN ('active', 'trialing', 'past_due')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_members bm
    JOIN public.subscriptions s ON s.business_id = bm.business_id
    WHERE bm.user_id = p.id
      AND s.status IN ('active', 'trialing', 'past_due')
  );