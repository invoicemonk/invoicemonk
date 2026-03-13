

# Fix: Subscription Not Updating After Payment + Add Upgrade Email

## Three Issues

### Issue 1 (Critical): Stripe webhook is silently rejected

The `stripe-webhook` function is **not listed in `supabase/config.toml`** with `verify_jwt = false`. Stripe sends webhook requests without a Supabase JWT, so Supabase's default JWT enforcement rejects every request before the function code runs. This is confirmed by zero webhook logs and zero subscriptions with a `stripe_subscription_id` set in the database.

**Fix**: Add `[functions.stripe-webhook] verify_jwt = false` to `config.toml` and redeploy.

### Issue 1b: CheckoutSuccess doesn't refresh business subscription

After checkout, `CheckoutSuccess.tsx` only invalidates `['subscription', user.id]` (the legacy user-based query). The Billing page and access control use `['business-subscription', businessId]` from `BusinessContext`. The business subscription cache is never refreshed, so even if the webhook worked, the UI would still show "starter" until the user manually refreshes.

**Fix**: Also invalidate business subscription queries and navigate to the business billing page.

### Issue 2: No upgrade confirmation email

There is no code that sends a confirmation email when a subscription is upgraded. The webhook should send one after successfully updating the subscription.

**Fix**: Add email sending to the `checkout.session.completed` handler in the stripe webhook, using Brevo (already used for lifecycle campaigns).

### Issue 3: Verification email not received

The signup code correctly calls `supabase.auth.signUp()` which triggers Supabase's built-in verification email. This is a **Supabase Auth configuration issue** — check:
- Authentication → SMTP settings in Supabase dashboard
- Email rate limits
- Whether the email landed in spam
- Whether the custom SMTP provider (if any) is working

This is not a code fix — it requires checking Supabase dashboard settings.

## Changes

### 1. `supabase/config.toml`
Add:
```toml
[functions.stripe-webhook]
verify_jwt = false
```

### 2. `supabase/functions/stripe-webhook/index.ts`
In the `checkout.session.completed` handler, after successfully updating/creating the subscription:
- Fetch the business owner's email and name
- Send an upgrade confirmation email via Brevo (reuse the pattern from `process-lifecycle-campaigns`)
- Include tier name, next billing date, and a link to the billing page

### 3. `src/pages/app/CheckoutSuccess.tsx`
- Invalidate `['business-subscription']` and `['user-businesses']` query keys (broad invalidation)
- Navigate to `/b/{businessId}/billing` instead of `/dashboard` (requires reading businessId from stored state or URL)
- Add a polling mechanism: retry fetching subscription status for up to 30 seconds to account for webhook processing delay

### 4. Redeploy `stripe-webhook` edge function
Required after config.toml change.

## Files Changed

| File | Change |
|---|---|
| `supabase/config.toml` | Add `stripe-webhook` with `verify_jwt = false` |
| `supabase/functions/stripe-webhook/index.ts` | Add upgrade confirmation email via Brevo |
| `src/pages/app/CheckoutSuccess.tsx` | Fix query invalidation, add polling, improve redirect |

## Note on Verification Emails

This is a Supabase Auth platform issue, not a code issue. Check:
1. Supabase Dashboard → Authentication → Email Templates (ensure verification template exists)
2. Supabase Dashboard → Authentication → SMTP Settings (ensure custom SMTP or default Supabase email is configured)
3. Check if the user's email provider is blocking or spam-filtering the email

