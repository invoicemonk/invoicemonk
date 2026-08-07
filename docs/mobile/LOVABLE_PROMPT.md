# Lovable prompt — Invoicemonk backend tasks (for the shared Supabase project)

> Paste this into Lovable. It targets the **backend only** (Supabase edge
> functions, storage buckets, RLS, data). The Invoicemonk **mobile app is
> already built and wired** to every endpoint below and degrades gracefully
> until each exists — **do not change any client behavior**, just implement the
> backend pieces to the exact contracts given. Work top-down: **P0 first.**

---

You are working on the Invoicemonk Supabase backend (shared by the web app and a
new React Native mobile app). Implement the following, in priority order.

## P0 — Critical

### 1. `scan-document` edge function — the hero feature, use the Lovable AI Gateway
Create and deploy a Supabase edge function `scan-document` that extracts
structured data from an uploaded receipt/invoice image using the **Lovable AI
Gateway** (a vision-capable model). All AI must run here — none on the device.

- **Auth:** require a valid Supabase user JWT; verify the user is a member of `business_id`.
- **Input (JSON):** `{ storage_path, source: 'receipt' | 'invoice', business_id }`. `storage_path` points into the private `receipt-scans` bucket (`{businessId}/{uuid}.jpg`).
- **Do:** download the image from `receipt-scans`; send it to the Lovable AI Gateway with a prompt to extract the fields below; parse the model output into the response shape; upsert a `scan_jobs` row (persist on success **and** failure so the client can retry from history).
- **200:** `{ job_id, status: 'done', extracted: { vendor, date, currency, subtotal, tax, total, line_items: [{ description, quantity, unit_price, amount }] }, confidence: 0-100 }`
- **Errors:** `401` missing/invalid token · `403` not a business member · `400` invalid body / path outside the business folder / unreadable image · `429` AI rate limit · `402` AI credits exhausted · `500` `{ error, job_id }`.
- **Do NOT** auto-create expenses or invoices — the client creates `expense_inbox_items` (receipts) or an invoice draft after the user reviews the extraction.

### 2. Private storage buckets + RLS
Create two **private** buckets. RLS: a business member may read/write **only inside their own** `{businessId}/…` folder.
- `verification-documents` — KYC documents. Path `{businessId}/{documentType}-{uuid}.jpg`. Backs `verification_documents`.
- `payment-proofs` — payment proof images. Path `{businessId}/{invoiceId}/{uuid}.jpg`. Backs `payment_proofs`.
- (`receipt-scans` already exists — leave it.)
When a `verification_documents` / `payment_proofs` row is created, `file_url` should be a **signed URL** (or add an endpoint that resolves the stored path to a signed URL) — the client currently stores the raw storage path.

### 3. Public verification for logged-out viewers
Verify links must work for recipients who aren't signed in. Provide **either**:
- a public `verify-invoice` edge function returning a sanitized invoice + business by `verification_id` (mirror the existing `verify-receipt`), **or**
- anon RLS policies allowing read of `invoices` / `receipts` + the owning `businesses` row **by `verification_id` only**.
Also standardize the public verify URLs to `/verify/invoice/:verification_id` and `/verify/receipt/:verification_id` (the receipt share link currently emits `/verify/:id`).

### 4. Account closure (guarded soft-close, never hard delete)
Either confirm a business owner can set `profiles.account_status = 'closure_requested'` (plus `account_closed_at`, `closed_by`, `closure_reason`) under RLS, **or** add a `close-account` edge function that does it. Financial records must be **retained** per `retention_locked_until` / `retention_policies` — never hard-deleted.

### 5. `business_sensitive_data` RLS
Allow a business member to insert/update their own business's row (`tax_id`, `vat_registration_number`, `cac_number`, etc.). The mobile business-profile save depends on it.

### 6. Customer referral source
`referral_links` / `referrals` are partner-scoped (`partner_id`) with no customer referral code. Add a **customer-facing referral code/link per user** plus a **stats source** (clicks, sign-ups, rewards) the app can read — or expose an edge function returning `{ referral_url, clicks, signups, rewards }` for the current user.

## P1 — Important
Create these edge functions to the stated shapes (the client already calls them with graceful fallbacks):
- `email-report` — `{ business_id, currency_account_id, period, start_date, end_date, format: 'pdf'|'csv', recipient_email }` → email the financial report.
- `generate-export` — `{ business_id, currency_account_id, period, start_date, end_date, format }` → create an `export_manifests` row + a retrievable file.
- `export-user-data` — full-account GDPR export → emailed download link.
- `cancel-subscription` — real Stripe cancellation (client currently only stamps `cancelled_at`).

Also:
- Confirm deployed + contracts match: `send-invoice-email`, `send-receipt-email`, `generate-receipt-pdf`, `generate-report`, `generate-tax-report`.
- Provide real values/endpoints for: per-plan Stripe **checkout URL**, per-business Stripe **Connect** onboarding link, per-tier **pricing**.
- **Seed `tier_limits.invoices_per_month` for every tier** (else the mobile quota gate treats it as unlimited).

## P2 — Confirm / polish
- Confirm the exact string values written for `account_status`, `verification_status`, `document_verification_status`, `notifications.type`, `support_tickets.status` (the app maps these defensively).
- Confirm `invoice_hash` / `compliance_hash` / `credit_note_hash` / `receipt_hash` are generated on issue, and the sign convention for `credit_notes.amount` (stored positive by the app).
- Add a `clients` row to `tier_limits` if the free-tier "1 client" cap should be enforced (none exists today).
- `export_manifests` has no `file_url` — add one (or a download endpoint) if per-export downloads are needed.
- Provide the real Tawk.to chat link + Help / Privacy / Terms URLs.

## Not your scope (handled in the mobile app)
- iOS/Android universal-link native config (`app.json` associatedDomains / intentFilters).
- Reconciling the mobile subscription provider to read the real `subscriptions` row.
