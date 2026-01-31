-- Phase 2: Create regional pricing table
CREATE TABLE public.pricing_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  currency text NOT NULL,
  tier public.subscription_tier NOT NULL,
  monthly_price integer NOT NULL,
  yearly_price integer,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(country_code, tier)
);

-- Enable RLS
ALTER TABLE public.pricing_regions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read pricing (public data)
CREATE POLICY "Pricing regions are viewable by everyone" 
ON public.pricing_regions FOR SELECT USING (true);

-- Add region tracking to subscriptions
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS pricing_region text,
  ADD COLUMN IF NOT EXISTS billing_currency text;

-- Insert Nigeria pricing (NGN)
INSERT INTO public.pricing_regions (country_code, currency, tier, monthly_price, yearly_price) VALUES
  ('NG', 'NGN', 'starter', 0, 0),
  ('NG', 'NGN', 'professional', 499900, 4999000),
  ('NG', 'NGN', 'business', 1499900, 14999000);

-- Insert US/International pricing (USD) - marked as default
INSERT INTO public.pricing_regions (country_code, currency, tier, monthly_price, yearly_price, is_default) VALUES
  ('US', 'USD', 'starter', 0, 0, true),
  ('US', 'USD', 'professional', 500, 4800, true),
  ('US', 'USD', 'business', 1500, 14400, true);

-- Insert UK pricing (GBP)
INSERT INTO public.pricing_regions (country_code, currency, tier, monthly_price, yearly_price) VALUES
  ('GB', 'GBP', 'starter', 0, 0),
  ('GB', 'GBP', 'professional', 400, 3840),
  ('GB', 'GBP', 'business', 1200, 11520);

-- Insert Canada pricing (CAD)
INSERT INTO public.pricing_regions (country_code, currency, tier, monthly_price, yearly_price) VALUES
  ('CA', 'CAD', 'starter', 0, 0),
  ('CA', 'CAD', 'professional', 700, 6720),
  ('CA', 'CAD', 'business', 2000, 19200);

-- Phase 6: Create trigger to auto-assign starter subscription on signup
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status, current_period_start)
  VALUES (NEW.id, 'starter', 'active', NOW())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_created_subscription ON public.profiles;
CREATE TRIGGER on_profile_created_subscription
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_subscription();