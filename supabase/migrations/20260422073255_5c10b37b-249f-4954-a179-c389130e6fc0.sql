-- Restore Rico Metzger's subscription (Titanium Coder EOOD)
-- Root cause: a stale checkout.session.completed webhook on Mar 14 overwrote
-- stripe_subscription_id with the refunded sub sub_1TACG8…; the daily
-- sync-subscriptions cron then queried that dead sub on Apr 19 and downgraded
-- the row to starter/cancelled. The user's *real* live sub on Stripe is
-- sub_1TAUQyFQfE4jyFlFqddXkC6k (last successful charge Apr 13), so we repoint
-- the row at it and restore the Professional tier.

UPDATE public.subscriptions
SET
  tier = 'professional',
  status = 'active',
  stripe_subscription_id = 'sub_1TAUQyFQfE4jyFlFqddXkC6k',
  current_period_start = '2026-04-13 00:00:00+00',
  current_period_end = '2026-05-13 00:00:00+00',
  cancelled_at = NULL,
  updated_at = now()
WHERE id = 'b2430849-0fa3-48f0-9d90-3282eb988109';

-- Audit trail for the manual repair
INSERT INTO public.audit_logs (
  business_id,
  user_id,
  actor_role,
  actor_id,
  entity_id,
  entity_type,
  event_type,
  metadata
)
VALUES (
  '87d2b8b8-8b82-49a1-b00c-8a9363a26471',
  '5e289890-e224-4bc5-8851-ce2c0a7c5313',
  'platform_admin',
  NULL,
  'b2430849-0fa3-48f0-9d90-3282eb988109',
  'subscription',
  'SUBSCRIPTION_CHANGED',
  jsonb_build_object(
    'action', 'manual_repair',
    'reason', 'Stale webhook overwrote stripe_subscription_id with refunded sub; sync cron then downgraded. See investigation.',
    'old_stripe_subscription_id', 'sub_1TACG8FQfE4jyFlFsRhI9jsG',
    'new_stripe_subscription_id', 'sub_1TAUQyFQfE4jyFlFqddXkC6k',
    'restored_tier', 'professional',
    'restored_status', 'active'
  )
);