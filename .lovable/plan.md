## What actually happened (updated after checking Stripe)

Rico's Stripe customer `cus_U8TCXJm3KyLHQH` currently has **three live subscriptions**, which is the root of the mess:


| Stripe sub                     | Price  | Status       | Notes                                                                   |
| ------------------------------ | ------ | ------------ | ----------------------------------------------------------------------- |
| `sub_1TAUQyFQfE4jyFlFqddXkC6k` | $5/mo  | **past_due** | The original starter plan. Never cancelled when Rico upgraded.          |
| `sub_1TqZCqFQfE4jyFlFVXDZj2Q8` | $15/mo | active       | Legit upgrade — invoice 0006 ($15, paid, 2026-07-05 12:18)              |
| `sub_1TqZFlFQfE4jyFlFCbCm2Rzb` | $15/mo | active       | **Duplicate** — invoice 0007 ($15, paid, 2026-07-05 12:21, 3 min later) |


Our `public.subscriptions` row for Rico still points at the old $5 sub (`sub_1TAUQyFQfE4jyFlFqddXkC6k`), so the app has been tracking the wrong subscription this whole time. When that $5 sub tried to renew this month (invoice 0008, $5, still open), the card wasn't charged the expected way and Stripe flipped it to `past_due`; our webhook mirrored that, and Rico sees "downgraded / payment issue" in the app.

Meanwhile, Stripe has been quietly holding **two active $15 subs** on the same customer — Rico paid $15 twice on July 5. Per Rico, the intent was: keep the $15 plan, apply the second $15 to a future month so he shouldn't be charged again until after August. His payment history he wants credited is March $5, April $5, May $5, June $15, August $15.

## Fix — Part A: Restore Rico's account (Stripe + DB)

Nothing below runs until you approve; every write touches live money.

1. **Void invoice `in_1Tsia4FQfE4jyFlFQByDQfo9**` (the open $5 renewal on the old sub). No card charge attempted.
2. **Cancel `sub_1TAUQyFQfE4jyFlFqddXkC6k**` (the $5 sub) with `invoice_now=false`, `prorate=false`, metadata `{ cancellation_reason: "duplicate_of_15_plan", handled_by: "support_manual_fix" }`. This is the "deactivate the old $5 subscription" step you called out.
3. **Cancel `sub_1TqZFlFQfE4jyFlFCbCm2Rzb**` (the duplicate $15 sub) with `invoice_now=false`, `prorate=false`, metadata `{ cancellation_reason: "duplicate_charge_of_sub_1TqZCqFQfE4jyFlFVXDZj2Q8", handled_by: "support_manual_fix" }`. We do **not** refund invoice 0007 — per Rico's request, keep the money on account as pre-paid coverage.
4. **Move the surviving $15 sub `sub_1TqZCqFQfE4jyFlFVXDZj2Q8` forward so the next charge lands after August**, using Stripe's `trial_end` field on the subscription (`POST /v1/subscriptions/sub_1TqZCqFQfE4jyFlFVXDZj2Q8` with `trial_end = <unix ts for 2026-09-01 00:00 UTC>`, `proration_behavior = "none"`). Stripe won't invoice again until that trial_end. This is the accepted Stripe pattern for "give this customer N months of paid time without charging". Metadata: `{ reason: "credit_for_duplicate_15_charge_2026_07_05", covers: "July+August_2026" }`.
  - Alternative if `trial_end` fights the current period: post the $15 as a **negative customer balance transaction** (`customers.createBalanceTransaction`, amount `-1500`, currency `usd`, description referencing invoice 0007). Stripe will auto-consume it on the next renewal. Same net effect; pick whichever Stripe accepts cleanly. I'll try `trial_end` first.
5. **Repair our DB row** in `public.subscriptions` for id `b2430849-0fa3-48f0-9d90-3282eb988109`:
  - `stripe_subscription_id = 'sub_1TqZCqFQfE4jyFlFVXDZj2Q8'`
  - `status = 'active'`
  - `tier = 'professional'` (unchanged)
  - `current_period_end = <trial_end from step 4>`
  - `updated_at = now()`
  - Write an `audit_logs` row `event_type='SUBSCRIPTION_CHANGED', metadata={ action: 'manual_repair', reason: 'Old $5 sub cancelled; duplicate $15 sub cancelled; surviving $15 sub extended to cover July+August per customer request', old_stripe_subscription_id: 'sub_1TAUQyFQfE4jyFlFqddXkC6k', new_stripe_subscription_id: 'sub_1TqZCqFQfE4jyFlFVXDZj2Q8' }`. Same shape as the 2026-04-22 repair already in his audit trail.
6. **Send Rico a short confirmation email** from support summarising: old $5 plan cancelled, one duplicate $15 charge kept as credit, next charge on/after 2026-09-01.

We will not touch the March/April/May $5 invoices — they're already paid and consumed.

## Fix — Part B: Stop this class of bug from recurring

Two distinct code bugs made this possible; both need fixing so we don't do this to another customer.

1. **Upgrades never cancelled the previous sub.** In `supabase/functions/create-checkout-session/index.ts` (and/or `manage-subscription/index.ts`), the upgrade flow creates a brand-new Stripe subscription instead of updating the existing one, and never cancels the old one. Fix: before creating a new sub for a customer, look up their existing active/past_due subs (`stripe.subscriptions.list({ customer, status: 'all' })`); if one exists, either (a) `subscriptions.update` in place with the new price and `proration_behavior='always_invoice'` — the correct pattern for plan changes — or (b) after the new sub is confirmed paid in `stripe-webhook`, cancel the old one with `prorate=true`. I'll go with (a) since it's the Stripe-recommended path and avoids the duplicate-charge window entirely.
2. **Checkout has no idempotency, so a double click / retry creates a second sub.** Invoices 0006 and 0007 are 3 minutes apart with identical amount — that's a duplicate submit, not two intentional purchases. Fix in `create-checkout-session`: generate a stable idempotency key on the client (UUID stored on the button before the invoke fires) and pass it through as the `Idempotency-Key` header on the Stripe call. Same insert-first + no-op-on-23505 pattern noted earlier.
3. `**stripe-webhook` should reject a `checkout.session.completed` for a customer who already has an active paid sub on the same price**, and instead cancel the newly-created duplicate and refund/credit. Belt-and-braces so a webhook race can't recreate the same bug.
4. `**sync-subscriptions` guard**: before downgrading a `past_due` or `unpaid` sub, check whether the same customer has another active sub on a paid tier; if yes, repoint our row instead of cancelling. Extend the existing `tryRepointFromCustomer` helper in `supabase/functions/sync-subscriptions/index.ts` to also accept `active` siblings when the current row is `past_due`, not just when it's already `cancelled`. Had this guard existed, Rico's DB row would have auto-migrated to `sub_1TqZCqFQfE4jyFlFVXDZj2Q8` the first time the cron ran after July 5.
5. **Backfill scan (read-only):** query for any other customer with two paid invoices of the same amount within 10 minutes over the last 90 days, and for any customer with more than one active Stripe subscription. Surface results to support — do not auto-fix.

## Technical notes

- Relevant edge functions: `supabase/functions/create-checkout-session/index.ts`, `supabase/functions/manage-subscription/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/sync-subscriptions/index.ts`.
- DB row to repair: `public.subscriptions.id = 'b2430849-0fa3-48f0-9d90-3282eb988109'`. Service-role write from an edge function; no RLS / migration change required.
- No schema migration needed for Part A or Part B.
- I will *not* run any Stripe writes or DB updates until you approve. Confirming this plan is the go-ahead for Part A.

## Questions before I execute

1. Confirm the intended final state: one $15 subscription active, first charge no earlier than **2026-09-01**. If you want the next charge on a specific day in September (e.g. anniversary day 5), tell me and I'll set `trial_end` to that exact date. September.
2. OK to keep the duplicate $15 as pre-paid credit (via `trial_end`) rather than refunding it to Rico's card? Pre-paid
3. Ship Part B (upgrade-in-place + idempotency + webhook guard + sync-subscriptions guard) in the same change, or split into a follow-up? In the same change.