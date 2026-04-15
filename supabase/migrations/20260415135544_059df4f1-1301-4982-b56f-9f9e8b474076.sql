
-- Delete all non-US/non-default rows
DELETE FROM pricing_regions WHERE country_code != 'US';

-- Update US starter (keep as-is, just ensure defaults)
UPDATE pricing_regions SET currency = 'USD', is_default = true, updated_at = now() WHERE id = '2a0798df-68e1-4fb3-9d58-6bda391d4e75';

-- Update US professional to $29/mo, $290/yr with new Stripe Price IDs
UPDATE pricing_regions SET 
  monthly_price = 2900, 
  yearly_price = 29000, 
  currency = 'USD', 
  is_default = true,
  stripe_price_id_monthly = 'price_1TMTSQFQfE4jyFlFcQW6kt2O',
  stripe_price_id_yearly = 'price_1TMTSyFQfE4jyFlFAXLatYCp',
  updated_at = now()
WHERE id = '6b0da121-43a8-48e7-bb9d-1840dca50ede';

-- Update US business to $129/mo, $1290/yr with new Stripe Price IDs
UPDATE pricing_regions SET 
  monthly_price = 12900, 
  yearly_price = 129000, 
  currency = 'USD', 
  is_default = true,
  stripe_price_id_monthly = 'price_1TMTV0FQfE4jyFlF1f8tzar7',
  stripe_price_id_yearly = 'price_1TMTWVFQfE4jyFlFTTHc2EsO',
  updated_at = now()
WHERE id = 'cd26f1e2-290e-476a-b79f-b3aebac2252b';
