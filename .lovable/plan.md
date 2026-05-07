## What went wrong

I traced the May 5 incident through `stripe-webhook`, `create-checkout-session`, and `use-subscription`. There are three real bugs that, together, explain how a user with a failed payment ended up on Pro:

1. **Tier access is decided purely by `tier`, ignoring `status`.**  
   In `src/hooks/use-subscription.ts`, `isPaid = tier !== 'starter'` and `canAccess` / `hasTier` never look at `subscriptions.status`. So a row with `tier='professional'` and `status='past_due'`, `'incomplete'`, or `'unpaid'` still unlocks Pro everywhere. RLS and DB-side `check_tier_limit` likely behave the same.

2. **`checkout.session.completed` activates on Stripe sub status alone, not on actual payment.**  
   In `stripe-webhook` we only check `subscription.status === 'active' | 'trialing'` and then write `status:'active'`, `tier:'professional'`. We never inspect `subscription.latest_invoice.payment_intent.status`. With Stripe Checkout in subscription mode, a sub can briefly read as `active` or `trialing` before the charge is confirmed (free trials, async payment methods, SCA after-redirect). We trust it and upgrade the row.

3. **`invoice.payment_failed` sets status to `past_due` but does not downgrade the tier**, and no other event ever does. Combined with bug #1, the user keeps Pro features forever after a failed payment. There is also no handler for `invoice.payment_action_required` or for the `incomplete_expired` transition that Stripe emits ~23h after an unpaid initial invoice.

There is also a smaller correctness gap: `create-checkout-session` cancels conflicting-currency subs *before* the new payment is confirmed, so a failed new payment can leave a customer with no live sub at all.

## Plan

### 1. Make payment status authoritative on the server

Edit `supabase/functions/stripe-webhook/index.ts`:

- In `checkout.session.completed` (subscription branch), after retrieving the subscription, also verify the latest invoice's payment intent succeeded:
  - Retrieve `subscription.latest_invoice` with `expand: ['payment_intent']`.
  - Treat the upgrade as confirmed only if `subscription.status` is `active` or `trialing` **and** (`latest_invoice.status === 'paid'` OR `latest_invoice.payment_intent.status === 'succeeded'` OR `subscription.status === 'trialing'` with no amount due).
  - Otherwise: write the row with the requested tier but `status='incomplete'` (no upgrade email, no audit log saying "upgraded"), and return 200 so Stripe doesn't retry.

- In `customer.subscription.updated`, propagate Stripe statuses into a clear policy and downgrade tier when the sub is not in good standing:
  - `active` / `trialing` → keep tier, `status='active'` (or `'trialing'`).
  - `past_due` → keep `tier`, `status='past_due'` (allow grace).
  - `unpaid` / `incomplete` / `incomplete_expired` / `canceled` → set `tier='starter'`, `status='cancelled'` (or `'past_due'` for `unpaid` if we want one more grace cycle — pick one and document).

- Add a handler for `invoice.payment_action_required` that mirrors `invoice.payment_failed` (status → `past_due`, admin notified, no tier change yet).

- In `invoice.payment_failed`, after marking `past_due`, schedule no tier change yet but record an audit event so support can trace it. The actual downgrade is driven by Stripe's own `customer.subscription.updated` to `unpaid` / `canceled` when retries are exhausted, which the handler above will catch.

### 2. Make payment status authoritative on the client and in DB checks

Edit `src/hooks/use-subscription.ts` and `src/contexts/SubscriptionContext.tsx`:

- Treat the subscription as "entitled to paid features" only if `tier !== 'starter'` **and** `status` is one of `'active' | 'trialing' | 'past_due'` (past_due kept inside Stripe's standard ~3-day retry grace).
- Replace `isPaid`, `canAccess`, `hasTier` to use this combined predicate.
- Expose a new flag like `isInGracePeriod` (status === `'past_due'`) so the UI can show a banner.

If the DB function `check_tier_limit` (called from `useBusiness().checkTierLimit`) only looks at `tier`, update it via a migration so it returns `allowed:false` when `status NOT IN ('active','trialing','past_due')`. This is what `TierGatedRoute` relies on, so without it, the client guard alone would be bypassable.

### 3. Add a “payment failed” banner

A small `PaymentIssueBanner` shown in `BusinessLayout` when `status === 'past_due'` with a link to the Stripe customer portal (`manage-subscription { action: 'portal' }`). This converts the silent state into something the user can fix.

### 4. Don't kill the old sub before the new one is paid

In `supabase/functions/create-checkout-session/index.ts`, stop calling `stripe.subscriptions.cancel(...)` on conflicting-currency subs at checkout-creation time. Move that cleanup into `stripe-webhook` so it only runs after `checkout.session.completed` has confirmed the new sub is paid. That way a failed checkout leaves the customer on their previous plan instead of stranded on starter.

### 5. Backfill the affected user

After the code is in place, run a one-shot SQL migration that, for each `subscriptions` row with `tier != 'starter'` and `stripe_subscription_id IS NOT NULL`, fetches the live Stripe status via `sync-subscriptions` (already exists) and corrects `tier`/`status`. The May 5 user will be auto-corrected the next time `sync-subscriptions` runs because Stripe will report the sub as `incomplete_expired` / `canceled`. We can also call `sync-subscriptions` manually right after deploy.

## Files

- `supabase/functions/stripe-webhook/index.ts` — payment-confirmed gating, status-driven downgrade, new event handlers.
- `supabase/functions/create-checkout-session/index.ts` — remove premature cancel of conflicting subs.
- `src/hooks/use-subscription.ts`, `src/contexts/SubscriptionContext.tsx` — status-aware entitlement.
- `src/components/app/BusinessLayout.tsx` (+ new `src/components/billing/PaymentIssueBanner.tsx`) — past-due banner.
- New migration to update `check_tier_limit` to require an entitled status.
- Trigger one `sync-subscriptions` run post-deploy.

## Out of scope

- Switching to `payment_behavior: 'default_incomplete'` on the Stripe side. It would be cleaner long-term but requires reworking the success page; the gating fix above is sufficient and far less risky.
- Webhook idempotency rework (the existing guards #1 and #2 are fine for this incident).
