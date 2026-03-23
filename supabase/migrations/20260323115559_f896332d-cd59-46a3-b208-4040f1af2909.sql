
-- Add Stripe Connect and Paystack Subaccount columns to businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS stripe_connect_account_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_connect_status text NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS paystack_subaccount_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paystack_subaccount_status text NOT NULL DEFAULT 'not_started';

-- Create platform_fee_config table (admin-managed)
CREATE TABLE IF NOT EXISTS public.platform_fee_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  fee_percent numeric NOT NULL DEFAULT 2.5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_fee_config_provider_unique UNIQUE (provider)
);

-- Enable RLS on platform_fee_config
ALTER TABLE public.platform_fee_config ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage fee config
CREATE POLICY "Platform admins can manage fee config"
ON public.platform_fee_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));
