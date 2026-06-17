Plan: Add missing Stripe Connect webhook event handlers to `stripe-connect-webhook` edge function.

The `stripe-connect-webhook` currently only handles `account.updated`. The remaining events discussed (`capability.updated`, `person.updated`) need to be added so the Stripe Dashboard webhook subscription can be completed with all recommended events.

Changes
-------

1. **Refactor `stripe-connect-webhook/index.ts`**
   - Extract a shared `resolveBusinessId(supabase, accountId)` helper that looks up `business_id` from `account.metadata.business_id` first, then falls back to `business_sensitive_data.stripe_connect_account_id`.
   - Re-use the helper in `account.updated` and the new handlers so the resolution logic is not duplicated.

2. **Add `capability.updated` handler**
   - When the `transfers` or `card_payments` capability changes to `inactive` or `pending`, mark the business `stripe_connect_status` as `restricted`.
   - When both capabilities are `active` and `charges_enabled` / `payouts_enabled` are true, mark as `active`.
   - Audit-log the event as `STRIPE_CONNECT_CAPABILITY_UPDATED`.

3. **Add `person.updated` handler**
   - When `verification.status` on a person changes to `unverified` or `pending`, flag the business as `restricted`.
   - When the person becomes `verified` and the account is otherwise active, keep or restore `active` status.
   - Audit-log the event as `STRIPE_CONNECT_PERSON_UPDATED`.

4. **No database migrations required** — the existing `businesses` and `business_sensitive_data` tables already have the required columns.

5. **No secret changes required** — the existing `STRIPE_CONNECT_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` are already configured.

After deployment, the user will be able to safely add `capability.updated` and `person.updated` to the Stripe Connect webhook events list in the Stripe Dashboard without receiving 400 errors.