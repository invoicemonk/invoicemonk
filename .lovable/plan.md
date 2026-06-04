## Goal

Replace the single-step country picker with a guided multi-step onboarding wizard that collects every field needed for a business to be (a) compliance-complete and (b) able to issue legally valid invoices. By the time the user reaches the dashboard, the only remaining actions are "add a client" and "create an invoice".

## What "compliant + invoice-ready" requires today

Sourced from `profile-completion.ts`, `business-profile-guard.ts`, `jurisdiction-config.ts`, and the `BusinessProfile` page. Requirements branch on **entity type** (individual / business / nonprofit) and **jurisdiction**.

### 1. Always required (every entity, every jurisdiction)

- **Business / trading name** (`businesses.name`)
- **Country of operation** (`jurisdiction`) — drives every rule below
- **Default currency** (`default_currency`) — locks after first issued invoice
- **Contact email** (`contact_email`) — appears as issuer contact on invoices
- **Address country** (`address.country`)
- **Entity type** — individual / business / nonprofit

### 2. Required for businesses & nonprofits (not individuals)

- **Legal / registered name** (`legal_name`) — must match official registration
- **City** (`address.city`)
- **Commercial registration number** (`cac_number`) — only in jurisdictions where `isIssuerCacRequired` is true (e.g. NG, FR, KE)

### 3. Required for individuals

- **Government ID upload** (`document_verification_status` ≠ `not_uploaded`) — proves identity in place of a registration cert

### 4. Conditionally required by jurisdiction

- **Tax ID / Government ID** (`tax_id` or `government_id_value`) — mandatory for all non-individuals, and for individuals in jurisdictions where `isIssuerTaxIdRequired` is true (NG FIRS, KE KRA, FR SIREN, EU VAT countries, etc.)
- **VAT registration number** (`vat_registration_number`) — only when the jurisdiction has VAT (`showVat`) and the user marks themselves VAT-registered
- **Invoice number digit width** (`invoice_number_digits`) — auto-seeded from `jurisdictionConfig.invoiceNumberDigits`, no user input needed

### 5. Strongly recommended for invoice quality (not blocking, but should be collected once to avoid the settings page later)

- **Street address, state/region, postal code** — appear on every invoice
- **Business phone** — appears on invoices
- **Invoice prefix** (default `INV`)
- **Logo** + **brand color** — branded invoices
- **Default payment method** (bank transfer / mobile money / online payments toggle) — without this the first invoice has no "how to pay" block

## Proposed onboarding flow

Route the user from email-verified signup straight into `/onboarding`, a stepper that cannot be skipped. Each step writes to the existing `businesses` / `business_sensitive_data` / `currency_accounts` / `payment_methods` tables.

```text
Signup → Verify email → Select plan (paid)
   → Step 1  Location & entity
   → Step 2  Identity (legal name + tax/gov ID + CAC, conditional)
   → Step 3  Address & contact
   → Step 4  Tax setup (VAT toggle + VAT number when applicable)
   → Step 5  Invoice branding (prefix, logo, color)   
   → Step 6  Get paid (payment method or enable online payments)
   → Dashboard
```

### Step-by-step content

1. **Location & entity** — country, entity type, currency (auto-derived but editable). Reuses today's `CountryConfirmation` preview card.
2. **Identity** — fields appear conditionally:
  - businesses/nonprofits: legal name, tax ID, CAC (if jurisdiction needs it)
  - individuals in tax-ID jurisdictions: government ID number + ID document upload
3. **Address & contact** — street, city, state, postal code, phone, contact email (prefilled from auth).
4. **Tax setup** — only shown when `jurisdictionConfig.showVat`. Toggle "Are you VAT registered?" → reveal VAT number input. Show the jurisdiction's VAT label (TVA, VAT, GST, etc.).
5. **Branding** — invoice prefix (default INV), logo upload, brand color picker. Marked optional with a "Skip for now" link.
6. **Get paid** — one of: add a manual payment method (bank/mobile money fields based on country) **or** enable online payments (Stripe Connect / Paystack handoff). Without this step the first invoice has no payable instruction.

### Behaviour rules

- Stepper persists progress per business (new column `onboarding_step` on `businesses`, nullable; `completed` when done).
- A guard redirects any `/b/:id/*` route to `/onboarding/:step` until `onboarding_step = completed` OR the user explicitly chose "Skip" on optional steps 5/6.
- Steps 5 and 6 can be deferred — a soft banner reminds the user on the dashboard until done.
- Existing businesses with incomplete profiles get the same wizard the next time they log in (one-time backfill prompt), so we retire the heavy `BusinessProfile` settings page as the primary completion surface.
- `BusinessProfile` settings page stays for edits, but the giant "complete your profile" banners and `QuickSetupChecklist` are replaced by the wizard.

### Files in scope (for the implementation phase)

- New: `src/pages/app/onboarding/OnboardingWizard.tsx` + one file per step under `src/components/onboarding/`.
- New hook: `useOnboardingProgress` reading/writing `businesses.onboarding_step`.
- Migration: add `onboarding_step text` to `businesses`, backfill existing rows to `completed` only when `profile-completion` says so, otherwise `null`.
- Update `App.tsx` routes (replace single `/onboarding/country` with `/onboarding/:step`) and add a guard in `BusinessLayout`/`BusinessAccessGuard`.
- Retire: `CountryConfirmation.tsx`, `QuickSetupChecklist`, `CompleteProfileBanner` (folded into wizard).

## Out of scope

- Verification (Stripe Connect KYC, document review) stays where it is — the wizard only collects what's required for invoice compliance, not regulator verification.
- Team invites, recurring expenses, products/services — these remain post-onboarding.
- No changes to existing invoice/compliance logic; we just front-load the data collection.

## Open questions before I build

1. For step 6 (Get paid), should we **require** at least one payment method/online payments enabled, or allow skipping? We must require at least one payment method.
2. For existing users with incomplete profiles, do we force them through the wizard on next login, or only nudge with a banner? Yes
3. Should logo + brand color be part of the required flow or fully optional? Let's make logo required.