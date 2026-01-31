-- Backfill starter subscriptions for existing users without one
INSERT INTO public.subscriptions (user_id, tier, status, current_period_start)
SELECT 
  p.id,
  'starter',
  'active',
  p.created_at
FROM public.profiles p
LEFT JOIN public.subscriptions s ON p.id = s.user_id
WHERE s.id IS NULL
ON CONFLICT DO NOTHING;