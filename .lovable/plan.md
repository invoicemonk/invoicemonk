## Update default USD pricing

Run a single database migration against `pricing_regions` (rows where `is_default = true`) to reflect your new Stripe pricing.

### Changes

| Tier | Field | Old | New |
|---|---|---|---|
| Professional | monthly_price | $29.00 | **$15.00** |
| Professional | stripe_price_id_monthly | price_1TMTSQ…kt2O | **price_1TV2sVFQfE4jyFlFQWiQCRoF** |
| Professional | yearly_price | $290.00 | **$150.00** |
| Professional | stripe_price_id_yearly | price_1TMTSy…tYCp | *(unchanged)* |
| Business (SME) | monthly_price | $129.00 | **$49.00** |
| Business (SME) | stripe_price_id_monthly | price_1TMTV0…tzar7 | *(unchanged)* |
| Business (SME) | yearly_price | $1,290.00 | **$490.00** |
| Business (SME) | stripe_price_id_yearly | price_1TMTWV…2EsO | *(unchanged)* |

Note: amounts are stored in cents, so the SQL will write `1500`, `15000`, `4900`, `49000`.

### SQL to run

```sql
UPDATE public.pricing_regions
SET monthly_price = 1500,
    yearly_price  = 15000,
    stripe_price_id_monthly = 'price_1TV2sVFQfE4jyFlFQWiQCRoF'
WHERE is_default = true AND tier = 'professional';

UPDATE public.pricing_regions
SET monthly_price = 4900,
    yearly_price  = 49000
WHERE is_default = true AND tier = 'business';
```

### Out of scope
- No code changes — `useRegionalPricing` and `create-checkout-session` already read live from `pricing_regions`, so the new amounts and the new Pro Monthly price ID will flow through automatically.
- Existing active subscriptions on the old Stripe prices are not touched. They keep billing at their original amount until they are cancelled or the customer re-subscribes through new checkout.
- No changes to non-default (per-country) pricing rows, since the app currently only uses the default USD row.

### Verification after apply
1. Re-query `pricing_regions WHERE is_default = true` and confirm the four amounts and the new Pro Monthly price ID.
2. Open `/select-plan` in the app — Pro should show $15/mo and $150/yr; SME should show $49/mo and $490/yr.
3. Click "Upgrade to Pro (monthly)" and confirm the Stripe Checkout page shows $15.00 and the price line references `price_1TV2sVFQfE4jyFlFQWiQCRoF`.
