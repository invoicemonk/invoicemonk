# Add Welcome Email + Detailed Professional Upgrade Onboarding Email

## What's Missing Today

1. **No welcome email** -- When a user signs up, nothing is sent. They only get a verification email from Supabase Auth, then silence until lifecycle campaigns kick in 48-72 hours later.
2. **Upgrade email is too shallow** -- The current upgrade email (in stripe-webhook) just lists 4 bullet points. No step-by-step guidance, no links to specific features, no "from the founder" personal touch.

## What Gets Built

### 1. Welcome Email (sent immediately after signup)

A warm, personal email from the founder that:

- Welcomes the user by name
- Introduces Invoicemonk's core value (compliance-first invoicing)
- Provides a 4-step quick start guide with direct links:
  1. Complete your business profile → `/settings`
  2. Add your first client → `/clients`
  3. Create your first invoice → `/invoices/new`
  4. Set up payment methods → `/settings` (payment methods section)
- Mentions the Quick Setup Checklist on the dashboard
- Includes a personal sign-off from the founder
- Links to support/help

**Trigger**: Called from `track-auth-event` edge function when `event_type === "sign_up"`

### 2. Enhanced Professional Upgrade Email

Replace the current generic upgrade email with a detailed onboarding guide that:

- Congratulates the user personally
- Lists their new Professional-tier capabilities with links to each feature:
  - **Team collaboration** (up to 5 members) → `/team`
  - **Custom branding** (remove watermark, add logo) → `/settings`
  - **Unlimited invoices & receipts** → `/invoices/new`
  - **Unlimited currency accounts** → `/settings`
  - **Audit logs & compliance** → `/audit-logs`
  - **Data exports** → `/reports`
  - **AI receipt scanning** → `/expenses`
  - **Advanced accounting** → `/accounting`
- Includes a "Getting Started with Professional" section with 3 recommended first steps
- Has a personal sign-off from the founder
- Shows billing details (plan name, next billing date)

### 3. Business-tier Upgrade Email (bonus)

Same structure but highlights Business-specific features:

- **Unlimited team members**
- **API access**
- Everything in Professional, plus the above

## Technical Approach

### File: `supabase/functions/track-auth-event/index.ts`

- After successfully logging the sign_up event, fetch the user's profile (name, email)
- Call Brevo API to send the welcome email
- Non-blocking: if the email fails, log the error but don't fail the event tracking

### File: `supabase/functions/stripe-webhook/index.ts`

- Replace the `upgradeEmailTemplate` function with tier-specific templates
- `professionalUpgradeEmailTemplate` -- detailed guide for Professional features
- `businessUpgradeEmailTemplate` -- detailed guide for Business features
- Keep the existing `sendUpgradeEmail` function structure, just pass the appropriate template based on tier

## No New Dependencies

Both changes use the existing Brevo integration already in place. No new edge functions needed.

## Files Changed


| File                                           | Change                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `supabase/functions/track-auth-event/index.ts` | Add welcome email sending after sign_up event logging                          |
| `supabase/functions/stripe-webhook/index.ts`   | Replace generic upgrade template with tier-specific detailed onboarding guides |
