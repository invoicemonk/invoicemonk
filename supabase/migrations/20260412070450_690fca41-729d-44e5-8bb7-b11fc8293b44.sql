
-- Create trigger function to auto-provision starter subscription for new businesses
CREATE OR REPLACE FUNCTION public.provision_starter_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (business_id, user_id, tier, status)
  VALUES (NEW.id, NEW.created_by, 'starter', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to businesses table
DROP TRIGGER IF EXISTS trg_provision_starter_subscription ON public.businesses;
CREATE TRIGGER trg_provision_starter_subscription
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_starter_subscription();

-- Backfill: create starter subscriptions for businesses that have none
INSERT INTO public.subscriptions (business_id, user_id, tier, status)
SELECT b.id, b.created_by, 'starter'::subscription_tier, 'active'
FROM public.businesses b
LEFT JOIN public.subscriptions s ON s.business_id = b.id
WHERE s.id IS NULL;
