

# Fix: Checkout Currency Conflict + Default Currency Hardcoded to NGN

## Two Issues Identified

### Issue 1: Checkout fails with "Edge function returned a non-2xx status code"

**Root cause**: The Stripe error log shows:
> "You cannot combine currencies on a single customer. This customer has an active subscription...with currency ngn."

When a user signs up, `create_default_business()` creates a starter subscription. If the user later selects a non-Nigerian country (e.g., Bulgaria), their pricing region changes to USD/EUR/etc. But the Stripe customer already has an NGN subscription from the auto-created starter plan. Stripe doesn't allow mixing currencies on a single customer.

**Fix in `supabase/functions/create-checkout-session/index.ts`**:
- Before creating the checkout session, check the customer's existing currency in Stripe
- If there's a currency conflict, cancel/delete the existing free starter subscription in Stripe first (it's a free plan, so no billing impact)
- Alternatively, force the checkout session to use the same currency as the customer's existing subscription — but this is wrong because users should pay in their regional currency
- Best approach: **Cancel the old free Stripe subscription before creating the new paid one**, since the free starter plan doesn't involve actual Stripe billing anyway. The `stripe-webhook` handler will handle creating the new subscription record.

### Issue 2: Primary currency perpetually in Naira

**Root cause**: The `create_default_business()` database function hardcodes `jurisdiction: 'NG'` and `default_currency: 'NGN'` for ALL new users. The `auto_create_default_currency_account()` trigger then creates an NGN currency account.

When the user later selects their actual country on the Country Confirmation page, `default_currency` and `jurisdiction` are updated on the `businesses` table, BUT the default **currency account** is never updated — it remains as "NGN Account" with currency NGN. Since the dashboard, invoices, and all financial data are scoped to the currency account (not the business's `default_currency`), the user is stuck seeing NGN.

**Fix in `src/pages/app/CountryConfirmation.tsx`**:
- After updating the business jurisdiction and default_currency, also update the default currency account to match the new currency
- Update the currency account's `currency` and `name` fields

## Changes

### 1. Edge Function: `create-checkout-session/index.ts`
- After finding/creating the Stripe customer and before creating the checkout session, list the customer's active subscriptions
- If any exist with a different currency than the new checkout, cancel them in Stripe (they're free starter plans)
- This prevents the Stripe currency conflict error
- Add a more user-friendly error message as fallback

### 2. Country Confirmation: `src/pages/app/CountryConfirmation.tsx`
- After updating the business `default_currency`, also update the default currency account:
  ```sql
  UPDATE currency_accounts
  SET currency = newCurrency, name = newCurrency || ' Account'
  WHERE business_id = businessId AND is_default = true
  ```
- This ensures the user's active currency account matches their selected country's currency

### 3. Database Migration
- Update the `auto_create_default_currency_account()` trigger to read from the business's `default_currency` (already does this with `COALESCE(NEW.default_currency, 'NGN')` — this is fine)
- No migration needed; the issue is that the currency account isn't updated when the country changes post-creation

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/create-checkout-session/index.ts` | Cancel conflicting free subscriptions before creating checkout |
| `src/pages/app/CountryConfirmation.tsx` | Update default currency account when country is selected |

