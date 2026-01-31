-- Step 2: Insert Nigeria pricing for starter_paid tier (₦2,000/mo = 200000 kobo)
INSERT INTO pricing_regions (country_code, currency, tier, monthly_price, yearly_price, is_default)
VALUES ('NG', 'NGN', 'starter_paid', 200000, 2000000, false)
ON CONFLICT DO NOTHING;

-- Step 3: Update existing Nigeria pricing to correct values
-- Professional: ₦4,000/mo = 400000 kobo, ₦40,000/year = 4000000 kobo
UPDATE pricing_regions 
SET monthly_price = 400000, yearly_price = 4000000 
WHERE country_code = 'NG' AND tier = 'professional';

-- Business: ₦8,000/mo = 800000 kobo, ₦80,000/year = 8000000 kobo
UPDATE pricing_regions 
SET monthly_price = 800000, yearly_price = 8000000 
WHERE country_code = 'NG' AND tier = 'business';

-- Step 4: Update international (US default) pricing
-- Professional: $5/mo = 500 cents, $48/year = 4800 cents
UPDATE pricing_regions 
SET monthly_price = 500, yearly_price = 4800 
WHERE country_code = 'US' AND tier = 'professional' AND is_default = true;

-- Business: $19/mo = 1900 cents, $182.40/year = 18240 cents
UPDATE pricing_regions 
SET monthly_price = 1900, yearly_price = 18240 
WHERE country_code = 'US' AND tier = 'business' AND is_default = true;

-- Step 5: Add tier_limits for starter_paid tier
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
('starter_paid', 'invoices_per_month', 'unlimited', NULL, 'Unlimited invoices'),
('starter_paid', 'watermark_required', 'boolean', 1, 'Subtle Invoicemonk footer shown'),
('starter_paid', 'custom_branding', 'boolean', 0, 'Cannot remove Invoicemonk footer'),
('starter_paid', 'exports_enabled', 'boolean', 0, 'Export disabled'),
('starter_paid', 'reports_enabled', 'boolean', 0, 'Reports disabled'),
('starter_paid', 'audit_logs_visible', 'boolean', 0, 'Audit logs not visible'),
('starter_paid', 'verification_portal', 'boolean', 0, 'Basic verification only'),
('starter_paid', 'premium_templates', 'boolean', 0, 'Premium templates disabled'),
('starter_paid', 'remove_watermark', 'boolean', 0, 'Cannot remove watermark'),
('starter_paid', 'team_members', 'count', 1, 'Single user only')
ON CONFLICT DO NOTHING;