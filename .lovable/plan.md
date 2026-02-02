
# Plan: Fix Checkout Country Code Missing

## Problem
When upgrading to `starter_paid`, the `create-checkout-session` edge function fails with "Pricing not found for tier: starter_paid" because:

1. The frontend doesn't pass `countryCode` to the checkout function
2. The edge function defaults to "US" when region detection fails
3. There's no `starter_paid` pricing for US (it's Nigeria-only)

## Solution
Pass the detected country code from the frontend to the checkout session, ensuring the edge function uses the correct regional pricing.

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/app/Billing.tsx` | Modify | Pass countryCode from useRegionalPricing to checkout |

## Implementation Details

### Update Billing.tsx

Modify the `handleUpgrade` function to pass the country code:

```typescript
// Current (missing countryCode):
await createCheckoutSession(newTier, billingPeriod, currentBusiness?.id);

// Fixed (with countryCode):
await createCheckoutSession(newTier, billingPeriod, currentBusiness?.id, countryCode);
```

The `countryCode` is already available from `useRegionalPricing()` hook which returns the detected region based on the user's business jurisdiction.

## Why This Works

1. `useRegionalPricing` already detects the user's region (NG for Nigeria)
2. Passing this to the edge function ensures it uses the correct pricing table entry
3. Avoids reliance on edge function's business lookup (which may have RLS issues)

## Alternative Considered

Adding default `starter_paid` pricing for US was considered but rejected because:
- `starter_paid` is intentionally a Nigeria-only tier
- International users shouldn't see this tier option at all
- The frontend already correctly hides it for non-NG users

## Testing

After the fix:
1. Log in as a Nigerian business user
2. Go to Billing page
3. Click "Upgrade" on Starter (starter_paid) plan
4. Should redirect to Stripe Checkout without errors
