UPDATE public.pricing_regions
SET monthly_price = 1500,
    yearly_price  = 15000,
    stripe_price_id_monthly = 'price_1TV2sVFQfE4jyFlFQWiQCRoF'
WHERE is_default = true AND tier = 'professional';

UPDATE public.pricing_regions
SET monthly_price = 4900,
    yearly_price  = 49000
WHERE is_default = true AND tier = 'business';