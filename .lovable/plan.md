

# Fix: Professional Tier Benefits Not Accessible After Upgrade

## Root Cause Analysis

**Two separate bugs are causing this:**

### Bug 1: Subscription record has no `user_id`
The subscription for the upgraded business (`87d2b8b8-...`) has `user_id: NULL`. This is because the webhook/manual upgrade only sets `business_id` on the subscription record.

**Impact**: Three hooks query subscriptions by `user_id` instead of `business_id`, so they always see the user as "starter":
- `use-subscription.ts` → queries `.eq('user_id', user.id)` → returns null → defaults to "starter"
- `use-invoice-templates.ts` → uses `useSubscription()` → thinks user is "starter" → locks premium templates
- `use-upgrade-triggers.ts` → uses `useSubscription()` → thinks user is "starter" → keeps showing upgrade modal

### Bug 2: Stripe webhook has zero logs
The `stripe-webhook` edge function has **zero logs ever**, meaning Stripe events are never reaching the function. The config.toml is correct (`verify_jwt = false`), so the function is either not deployed or Stripe's webhook endpoint URL is not configured. This needs to be verified in the Stripe Dashboard.

## Fix Plan

### 1. Fix `use-subscription.ts` to check business-level subscriptions
The hook currently only queries by `user_id`. Update it to **also** query subscriptions by the user's business memberships as a fallback, so it picks up business-scoped subscriptions.

### 2. Backfill `user_id` on existing subscriptions (migration)
Set `user_id` on the professional subscription record from the business owner's `business_members` entry. Also update the webhook to always set `user_id` when creating/updating subscriptions.

### 3. Update `stripe-webhook/index.ts` to always set `user_id`
In the `checkout.session.completed` handler, look up the business owner and set `user_id` on the subscription record.

### 4. Deploy the stripe-webhook function
Redeploy the edge function and instruct the user to verify the Stripe webhook URL is configured.

## Files Changed

| File | Change |
|---|---|
| `src/hooks/use-subscription.ts` | Fall back to business-level subscription query when user-level returns null |
| `supabase/functions/stripe-webhook/index.ts` | Always set `user_id` on subscription records |
| New migration | Backfill `user_id` on existing subscriptions from business owners |

