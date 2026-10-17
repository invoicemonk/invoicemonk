# Shorten onboarding and unify invoice creation

## Goal
Reduce signup drop-off and remove unnecessary screen changes while preserving an explicit, informed choice between a paid subscription and Free. Make invoice creation/editing read like one invoice, not a stack of unrelated forms.

## User experience

### Signup and onboarding
1. Add **intent**, **country**, and **business type** (individual, business, nonprofit) to account creation. Keep tax IDs and other sensitive business details out of signup.
2. Carry the user's selected answers through email verification (and supported signup methods), then prefill the business setup with them. Save stated intent only as the user's explicit answer; save country and entity type to the business profile.
3. After email verification, show a standalone **plan/payment choice** page. Preselect **Professional** and preserve the existing monthly billing default. Make **Continue with Professional** initiate Stripe checkout; provide a clear, deliberate **Continue with Free** choice. This is a required choice screen, not a paid-only gate: Free remains available, and paid access is granted only after verified payment. Returning from cancelled checkout keeps the user on plan choice with an obvious Free option.
4. Replace the six remaining onboarding screens with one setup page containing the existing business, identity, address, tax, branding/logo, and payment-method fields. Prefill signup answers, keep tax and registration fields jurisdiction-sensitive, and retain inline errors, save/retry behavior, and completion routing.
5. Do not change receipt creation. Keep the business's client-payment method (how customers pay them) distinct from the subscription plan/payment choice.

### New and edit invoice
- Apply the same continuous, invoice-like layout to New Invoice and Edit Invoice, within one document surface rather than separate cards for each field group.
- Put issuer and client details side by side at the top where space permits; place issue/due dates and currency directly beneath; show line items next, followed by payment instructions and notes/terms.
- Keep template selection in the invoice document and have it update the invoice preview's appearance. Place totals and Save/Preview/Issue actions in the existing right-side summary on wide screens and keep them usable on small screens.
- Keep secondary tax/compliance/deposit controls inline near the information they affect, without hiding active settings. Keep blocking warnings visible.
- Preserve all existing rules and behavior: client and template requirements, valid line items, calculations, jurisdictional tax/TIN checks, currency-account rules, deposit/final invoice checks, profile/email issuance gates, draft/save/preview/issue flows, and edit behavior.

## Technical details
- Use the existing intent options, country/entity choices, business profile and sensitive-data persistence, Stripe checkout/session verification, and invoice data/mutations; avoid parallel data stores or bypassing server-side entitlement checks.
- Ensure pre-verification signup selections survive verification and OAuth/signup alternatives, and are only written to the authenticated user's records after identity is established. Reconcile legacy `has_selected_plan` accounts and checkout-cancel/resume paths so users do not loop or receive paid access without verified payment.
- Consolidate/reorder the existing New/Edit invoice JSX rather than duplicating business logic; retain selected template snapshots and any currently active advanced settings.
- Add focused tests for signup-answer persistence/required paid-vs-Free selection and invoice calculations/validation state where pure logic permits. Run relevant existing tests, type checks, and the preview checks available. If authenticated preview testing is unavailable, report that clearly rather than treating a signed-out check as end-to-end verification.

## Out of scope
- No signup collection of tax IDs or other sensitive compliance details.
- No change to receipts, subscription prices, plan entitlements, tax/compliance requirements, or customer payment processing beyond the requested plan-choice flow.
