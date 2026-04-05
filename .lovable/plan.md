

# Fix: RangeError "Invalid time value" in stripe-webhook

## Root Cause

The Sentry error shows `RangeError: Invalid time value` at `doUpdateSubscriptionByBusiness` (line ~856-857). This happens when `subscription.current_period_start` or `subscription.current_period_end` is `undefined` or `null`, causing `new Date(undefined * 1000)` which produces an invalid Date, and `.toISOString()` then throws.

This occurs during `customer.subscription.updated` events where Stripe may send a subscription object with missing period fields (e.g., during cancellation transitions or incomplete subscriptions).

## Fix

Add null guards before creating Date objects from `current_period_start` and `current_period_end` in all three helper functions: `doUpdateSubscriptionByBusiness`, `doUpdateSubscription`, and `updateSubscriptionByBusiness`.

If the value is missing, either skip updating that field or fall back to the current timestamp.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/stripe-webhook/index.ts` | Guard `current_period_start` and `current_period_end` against null/undefined before `new Date()` in all three subscription update functions (lines ~815-816, ~856-857, ~888-889, ~904-905) |

## Detail

Replace raw `new Date(subscription.current_period_end * 1000).toISOString()` with a safe helper:

```typescript
function safeISODate(epochSeconds: number | undefined | null): string | undefined {
  if (!epochSeconds) return undefined;
  const d = new Date(epochSeconds * 1000);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
```

Then use it in the update objects, filtering out undefined values so they don't overwrite existing good data.

