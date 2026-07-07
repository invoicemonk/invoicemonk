## Goal
Fix the Billing Management section on `/b/:businessId/billing` so it actually lists past payments (pulled from Stripe) instead of showing "No payment history". For the affected user, the duplicate charge will appear as **two invoice rows** — one dated in July, one in August — matching how they're happy to spread the charges.

## 1. New edge function: `list-stripe-payments`
Location: `supabase/functions/list-stripe-payments/index.ts`

- Verifies the caller via `supabase.auth.getUser(token)` (JWT verified in code, `verify_jwt = false` per project pattern).
- Resolves every Stripe customer tied to this user:
  - primary lookup by email via `stripe.customers.list({ email })`
  - plus any `stripe_customer_id`s from the `subscriptions` table for the user and for businesses they're a member of (covers users whose Stripe email differs from their auth email — matches the answered scope: "All of the user's subscriptions").
- For each customer, calls `stripe.invoices.list({ customer, limit: 100, expand: ['data.charge'] })`.
- Normalizes each invoice into:
  ```ts
  {
    id, number, created_at, period_start, period_end,
    amount, currency, status,               // paid | open | uncollectible | void
    description,                            // line item / plan nickname
    hosted_invoice_url, invoice_pdf,
    receipt_url                             // from expanded charge
  }
  ```
- Sorted newest first.
- Errors return `{ error }` with 500 so the UI can show a graceful fallback.

Secrets: uses existing `STRIPE_SECRET_KEY`. None to add.

## 2. Record the duplicate charge as two invoices (one-off backfill)
The user's second charge already exists in Stripe as an ordinary invoice — we just need it to *appear* as two rows spanning July and August so the history matches the agreed outcome.

Approach: create **two out-of-band Stripe invoices** on that customer, each for half the disputed amount, one dated in July and one in August, both marked paid out-of-band. The real (duplicate) Stripe charge is then voided from the customer's ledger so totals stay correct.

- Done via the `stripe--stripe_api_write` tool (no code change needed), not in application code:
  1. `PostInvoices` × 2 with `collection_method=send_invoice`, `auto_advance=false`, `description="Subscription — July 2026"` / `"Subscription — August 2026"`.
  2. `PostInvoiceitems` for the correct half-amount on each.
  3. `PostInvoicesFinalize` then `PostInvoicesPay` with `paid_out_of_band=true`.
  4. Void the original duplicate invoice with `PostInvoicesVoid` so the customer isn't shown as charged twice for the same period.
- Requires the user to confirm:
  - the affected **user email / business** and
  - the **Stripe invoice ID** of the duplicate charge
  before I run these Stripe writes (they mutate live billing data).

After this backfill, `list-stripe-payments` will naturally return the two July/August rows because it reads Stripe directly.

## 3. Frontend hook: `useBillingPayments`
Location: `src/hooks/use-billing-payments.ts`

- `useQuery(['billing-payments', userId])` → `supabase.functions.invoke('list-stripe-payments')`
- 60s stale time, refetch on window focus.

## 4. Rework the "Billing Management" card in `src/pages/app/Billing.tsx`
Replace the current empty state + lone "Open Customer Portal" button (lines 332–367) with:

```text
┌─ Billing Management ─────────────────── [Open Customer Portal ↗] ─┐
│ Manage your payment methods and view invoices                     │
│                                                                   │
│  Date         Description              Amount     Status          │
│  ─────────────────────────────────────────────────────────── ⋯    │
│  Aug 2 2026   Subscription — August    $14.50     Paid   PDF View │
│  Jul 2 2026   Subscription — July      $14.50     Paid   PDF View │
│  Jul 2 2026   Pro (monthly)            $29.00     Paid   PDF View │
│  Jun 2 2026   Pro (monthly)            $29.00     Paid   PDF View │
│  ...                                                              │
└───────────────────────────────────────────────────────────────────┘
```

- Table via shadcn `Table` primitives.
- Amount formatted with `Intl.NumberFormat` per row's currency.
- Status → colored `Badge` (`paid` default, `void`/`refunded` secondary, `open`/`uncollectible` destructive).
- Rightmost column: icon buttons opening `hosted_invoice_url` and `invoice_pdf` in a new tab.
- Loading: 5 `Skeleton` rows.
- Error: inline muted line "Couldn't load payment history — open the Customer Portal for the full record."
- Non-paid users (no `hasPaidSubscription`): keep today's "Upgrade to a paid plan" empty state, no fetch.
- The existing "Manage Subscription" button in the Current Plan card stays untouched.

## Files
- **New:** `supabase/functions/list-stripe-payments/index.ts`
- **New:** `src/hooks/use-billing-payments.ts`
- **Edit:** `src/pages/app/Billing.tsx` (Billing Management card body only)
- **No new DB tables or migrations.**

## Out of scope
- No webhook or DB mirroring of Stripe invoices.
- No refunds — the money stays with us; the fix is purely how it's presented (two months of billing).
- No changes to checkout, subscription reconciliation, or the Customer Portal flow.

## What I need from you before running the Stripe backfill
- The affected user's email (or business).
- The Stripe **invoice ID** (or payment intent) of the duplicate charge.

I'll build the code changes above regardless; the two-invoice split via Stripe is a separate confirmation because it writes to live Stripe data.
