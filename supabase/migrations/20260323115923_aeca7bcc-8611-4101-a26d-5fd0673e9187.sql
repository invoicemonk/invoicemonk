INSERT INTO public.platform_fee_config (provider, fee_percent, is_active)
VALUES ('stripe', 2.5, true), ('paystack', 2.5, true)
ON CONFLICT (provider) DO NOTHING;