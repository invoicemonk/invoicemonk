## Problem

A user has tier `professional` in our `subscriptions` table even though their Stripe payment was cancelled. MRR is overstated as a result.

Two real gaps allow this:

1. **`sync-subscriptions` cron is too narrow.** It only inspects rows where `current_period_end < now() - 3 days`. A sub whose payment was cancelled hours/days into the period (or whose `current_period_end` is `NULL`) is ignored, so the daily reconciliation never catches it.
2. **Webhook reliance.** We mutate `subscriptions.tier`/`status` only from `stripe-webhook` events. If a `customer.subscription.deleted`/`updated`/`invoice.payment_failed` event was missed, retried out of order, signed with an old secret, or arrived for a `stripe_subscription_id` we never recorded (because the upgrade path stamped tier from `checkout.session.completed` before the sub was finalised), the DB stays on `professional`.

## Fix

### 1. Broaden the daily reconciler (`supabase/functions/sync-subscriptions/index.ts`)

Replace the narrow "stale-period" query with a reconcile pass over **every** paid row:

```ts
.from("subscriptions")
.select("id, stripe_subscription_id, stripe_customer_id, business_id, tier, status, current_period_end")
.in("status", ["active", "past_due"])
.neq("tier", "starter")
```

For each row:
- If `stripe_subscription_id` is NULL → try `tryRepointFromCustomer`; else downgrade to `starter`/`cancelled`.
- Else fetch the sub from Stripe.
  - `active` / `trialing` → refresh `current_period_start`/`end` (existing renew path).
  - `past_due` → set local `status='past_due'`, keep tier (existing grace-period UX).
  - `canceled` / `incomplete_expired` / `unpaid` / `incomplete` (older than 24h) → repoint or downgrade to `starter`/`cancelled`, void pending commissions, write `SUBSCRIPTION_CHANGED` audit with `reason: stripe_status_<x>`.

Add a per-run cap (e.g. 200 rows) and log counts so the cron stays well under the 30s timeout.

### 2. Add an on-demand reconciler endpoint

New edge function `reconcile-subscription` (or accept `?subscription_id=` / `?business_id=` on `sync-subscriptions`) that runs the same logic for a single row. Used by:
- Admin "Reconcile now" button on the businesses sheet.
- A self-heal call from `useSubscription` when it detects `tier !== 'starter'` AND `current_period_end` is in the past or `status='past_due'` for >24h.

### 3. Plug the webhook gap

In `stripe-webhook`'s `customer.subscription.deleted` handler, if the update by `stripe_subscription_id` matches 0 rows, fall back to matching by `stripe_customer_id` + business and downgrade. Same fallback for `customer.subscription.updated` when the incoming Stripe status is terminal (`canceled` / `incomplete_expired` / `unpaid`).

### 4. Backfill the affected user(s)

After the broader cron is in place, manually invoke `sync-subscriptions` once (or call the new single-sub reconciler from the admin UI) so MRR drops back to truth immediately. No data migration needed — the cron will do it.

## Out of scope

- No changes to `create-checkout-session`, the Stripe price IDs, or the MRR formula itself.
- No new Stripe events subscribed; we already receive everything we need.
- No UI changes beyond an optional admin "Reconcile now" button — happy to defer that if you'd rather keep this fix backend-only.

## Files touched

- `supabase/functions/sync-subscriptions/index.ts` (broaden query + statuses)
- `supabase/functions/stripe-webhook/index.ts` (customer-id fallback in deleted/updated)
- `supabase/functions/reconcile-subscription/index.ts` (new, optional)
- `src/pages/admin/AdminBusinesses.tsx` or `BusinessDetailSheet.tsx` (optional Reconcile button)
