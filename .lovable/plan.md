## Root cause

`src/pages/app/CheckoutSuccess.tsx` (lines 22–30) unconditionally writes `has_selected_plan = true` on the profile as soon as the page mounts. There is **no check that the Stripe session was actually paid** — it just trusts that the user landed on `/checkout/success`.

That means a user can reach the paid state without paying by:

- Opening the Stripe Checkout page, closing it, then manually navigating to `/checkout/success` (the URL is predictable and protected only by auth).
- Hitting back/forward to a previously visited `/checkout/success?session_id=…` after abandoning payment.
- Any redirect that lands on `/checkout/success` for an unpaid/expired session.

The Stripe customer row exists because `create-checkout-session` creates the customer **before** the user pays (lines ~150–165 of the edge function). That explains why `dariensm15@gmail.com` shows up in Stripe with no payment, yet still passed the `BusinessRedirect` gate (`has_selected_plan` flag) and reached onboarding.

The webhook (`stripe-webhook` checkout.session.completed handler) already sets `has_selected_plan = true` correctly **after** payment is confirmed. The client-side flip is redundant and unsafe.

## Fix

### 1. Verify the session server-side before trusting success

New edge function `verify-checkout-session` (verify_jwt = false, in-code auth):

- Input: `{ session_id }`
- Auth: validate caller's JWT, get `user.id`.
- Fetch `stripe.checkout.sessions.retrieve(session_id)`.
- Confirm `session.client_reference_id === user.id` AND (`payment_status === 'paid'` OR `status === 'complete'`).
- Only then update `profiles.has_selected_plan = true` and clear `intended_tier*` using the service-role client.
- Return `{ paid: boolean, tier, businessId }`.

### 2. Harden `CheckoutSuccess.tsx`

- Remove the unconditional `update({ has_selected_plan: true, ... })`.
- Call `verify-checkout-session` with the `session_id` from the URL.
- If `paid === false` (or no `session_id`): show a "Payment not confirmed" state with a button back to `/select-plan`, do **not** flip the flag, do **not** auto-redirect to `/dashboard`.
- Keep the polling/invalidations for the case where the webhook is still catching up.

### 3. Defense in depth in `BusinessRedirect.tsx`

Currently the gate is just `profile.has_selected_plan`. Add a second check: look up an active subscription for the user (matching the existing `useSubscription` query — either a user-level sub or via `business_members → subscriptions` with `status in ('active','trialing','past_due')`). If `has_selected_plan` is true but **no** active subscription exists, redirect to `/select-plan` instead of letting them through. This catches any future bypass and the existing leaked accounts.

Apply the same active-subscription check at the entry of `OnboardingWizard` so a user who somehow keeps the flag still can't progress through onboarding without paying.

### 4. Backfill / cleanup for the leaked user(s)

One-off migration (or admin script) that resets `has_selected_plan = false` and clears `intended_tier*` for any profile whose user has **no** active/trialing/past_due subscription row. This will push `dariensm15@gmail.com` (and anyone else who slipped through the same hole) back to `/select-plan` on their next visit.

## Files touched

- New: `supabase/functions/verify-checkout-session/index.ts`
- Edit: `src/pages/app/CheckoutSuccess.tsx` (remove trust-the-client flip, call verifier, render unpaid state)
- Edit: `src/components/app/BusinessRedirect.tsx` (require active subscription, not just flag)
- Edit: `src/pages/app/OnboardingWizard.tsx` (same active-sub gate)
- New migration: backfill cleanup of `has_selected_plan` for users with no live subscription.

## Out of scope

No changes to pricing, plan list, checkout creation, or webhook handler — webhook already does the right thing.

## Questions before I build

1. For the backfill, should I **reset `has_selected_plan` for every user with no active sub** (catches all past leaks), or **only** `dariensm15@gmail.com` (surgical)? catch all past leaks
2. If a user lands on `/checkout/success` with an unpaid/expired session, should the page (a) show "Payment not completed, try again" with a button to retry, or (b) silently redirect back to `/select-plan`? Show "Payment not completed, try again" with a button to retry