
-- 1) New signups no longer need to pass through the paywall to enter the app.
ALTER TABLE public.profiles ALTER COLUMN has_selected_plan SET DEFAULT true;

-- 2) Tighten free-tier limits to the agreed spec.
UPDATE public.tier_limits SET limit_value = 3 WHERE tier = 'starter' AND feature = 'invoices_per_month';
UPDATE public.tier_limits SET limit_value = 0 WHERE tier = 'starter' AND feature = 'accounting_enabled';

-- 3) Add a clients_limit feature (1 for starter, unlimited for higher tiers).
INSERT INTO public.tier_limits (tier, feature, limit_type, limit_value, description)
VALUES
  ('starter',       'clients_limit', 'count', 1,  'Maximum number of clients'),
  ('starter_paid',  'clients_limit', 'count', -1, 'Unlimited clients'),
  ('professional',  'clients_limit', 'count', -1, 'Unlimited clients'),
  ('business',      'clients_limit', 'count', -1, 'Unlimited clients')
ON CONFLICT DO NOTHING;
