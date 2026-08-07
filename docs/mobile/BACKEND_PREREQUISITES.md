# Backend Prerequisites — Mobile M6

> What the **mobile app** needs from the **backend / web team** for the M6
> features to be fully functional. Everything below already ships in the app and
> **degrades gracefully** today, but stays a stub/placeholder until the
> corresponding backend piece exists. Shared Supabase project
> `skcxogeaerudoadluexz`. Companion to `HANDOFF.md` + `M6_COMPLIANCE_PLAN.md`.
>
> Priority: **P0** = feature is non-functional without it · **P1** = works for
> the owner/authed case but degrades (e.g. graceful fallback / stub) · **P2** =
> polish, decision, or data-seed.

## 1. Storage buckets (private, RLS)

| Bucket | Priority | Used by | Needs |
|---|---|---|---|
| `verification-documents` | **P0** | `src/lib/kyc-upload.ts` → `verification_documents` | Create bucket; RLS: business members read/write only inside their own `{businessId}/…` folder. Path convention `{businessId}/{documentType}-{uuid}.jpg`. |
| `payment-proofs` | **P0** | `src/lib/payment-proof-upload.ts` → `payment_proofs` | Create bucket; same member-scoped RLS. Path `{businessId}/{invoiceId}/{uuid}.jpg`. |
| `receipt-scans` | — | already exists (scan flow, expenses) | none |
| support-attachments | P2 | contact form (attach omitted for now) | future — bucket + RLS if we enable ticket attachments |

Until the first two exist, KYC document capture and payment-proof upload fail and the app shows a graceful "not enabled yet" message (the payment still records; the KYC submit is skipped).

## 2. Edge functions

### ⭐ `scan-document` — the hero feature (P0), **use Lovable AI Gateway**

The whole reason the app exists: snap a receipt/invoice → AI extracts the fields → the app files it. **The mobile client is fully built** (`src/lib/scanning/*` — capture, compress, upload to `receipt-scans`, call this function, normalize JSON, review, save as expense/receipt/invoice; offline outbox + manual-entry fallback). What's outstanding is the **backend edge function itself**, which must run the AI **via the Lovable AI Gateway** (per BACKEND_CONTRACT — no AI SDK ships on the device). Until it's deployed, every scan degrades to manual entry (`extract.ts` returns `isFallback: true`).

- **Depends on** the `receipt-scans` bucket (already exists) — see §1.
- **Contract** (from `docs/mobile/BACKEND_CONTRACT.md`, and what `extract.ts` parses):
  - Request `{ storage_path, source: 'receipt'|'invoice', business_id }`
  - `200` `{ job_id, status: 'done', extracted: { vendor, date, currency, subtotal, tax, total, line_items[] }, confidence: 0–100 }`
  - Status codes the app already handles: `401` auth · `403` not a member · `400` bad image · `429` rate-limit (retry) · `402` AI credits exhausted (billing) · `500` `{ error, job_id }`
  - Persist the job in `scan_jobs` regardless of outcome; the client creates the `expense_inbox_items` / invoice draft after user review (function must NOT auto-create those).

**Other functions — already invoked with a try/catch fallback, just confirm deployed + contract:**
`send-invoice-email`, `send-receipt-email`, `generate-receipt-pdf`, `generate-report`, `generate-tax-report`.

**New / needs creation or name+contract confirmation:**

| Function | Priority | App location | Expected contract |
|---|---|---|---|
| `email-report` | P1 | `src/features/accounting/use-reports-export.ts` | body `{ business_id, currency_account_id, period, start_date, end_date, format: 'pdf'\|'csv', recipient_email }` → emails the report. |
| `generate-export` | P1 | same | body `{ business_id, currency_account_id, period, start_date, end_date, format }` → creates an `export_manifests` row + a retrievable file. |
| `export-user-data` | P1 | `src/features/settings/use-settings.ts` | GDPR full-account export → emailed download link. |
| `close-account` | **P0** | `src/features/settings/use-settings.ts` | Proper account-closure transition under RLS. App currently writes `profiles.account_status='closure_requested'` directly — confirm that's allowed, or move it behind this fn. **Must respect `retention_locked_until` — never hard-delete.** |
| `verify-invoice` (public) | **P0** | `src/features/verify/use-verify.ts` | Public verification of an invoice by `verification_id` (a `verify-receipt` already exists per BACKEND_CONTRACT). Alternatively provide anon RLS (see §3). |
| `cancel-subscription` | P1 | `src/features/billing/use-billing.ts` | Real Stripe cancel; app currently only stamps `cancelled_at`. |

## 3. RLS policies

- **P0 — Public verify reads.** Logged-out viewers of `/verify/invoice/:id`, `/verify/receipt/:id`, `/invoice/:id` need anon read of the matching `invoices` / `receipts` + owning `businesses` row (by `verification_id` / id), **or** the verify edge functions above. Without this, logged-out users always get the "couldn't verify / not available" negative state; authed owners work. (`src/features/verify/use-verify.ts`.)
- **P0 — `business_sensitive_data`.** Business members must be able to insert/update their own row (tax_id, vat_registration_number, cac_number). The business-profile save writes `businesses` first, then `business_sensitive_data` — if the second write is blocked, the profile partially saves and surfaces an error. (`src/features/compliance/use-business-profile.ts`.)
- **P1** — confirm member insert on `verification_documents`, `payment_proofs`, `support_tickets`; business-scoped read on `export_manifests`.

## 4. File URLs

- `verification_documents.file_url` and `payment_proofs.file_url` currently store the **storage path** (the app has no way to mint a durable signed URL). Backend review/display should resolve these to **signed URLs**. (`use-verification.ts`, `use-invoice-compliance.ts`.)
- **`export_manifests` has no `file_url` column** → there is **no per-manifest file download** in-app (the export list shares metadata + `integrity_hash` only). Add a `file_url`/download endpoint if downloads are required. (`src/app/accounting/exports.tsx`.)

## 5. App-side constants that need real sources

| Constant | Priority | Location |
|---|---|---|
| Stripe **checkout URL** (per plan) | P1 | `src/app/billing/upgrade.tsx` `CHECKOUT_URL` |
| Stripe **Connect** onboarding link (per business) | P1 | `src/app/business/verification.tsx` `STRIPE_CONNECT_URL` |
| Per-tier **pricing** | P2 | `src/features/billing/use-billing.ts` `TIER_PRICE_*` |
| **Tawk.to** chat link | P1 | `src/app/support/index.tsx` `TAWK_CHAT_URL` |
| Help / Privacy / Terms URLs | P2 | `src/app/support/index.tsx` |
| **Customer referral code + stats** | **P0** | `src/app/referrals/index.tsx` — referral tables are **partner-scoped** (`partner_id`, off-limits) and there's no customer referral-code column; the app uses an interim `?ref=<userId>` link and shows `—` stats. Needs a customer-facing code/link + a stats source. |
| **Universal-link native config** | **P0** | `app.json` — add iOS `associatedDomains` (`applinks:invoicemonk.com`) + Android `intentFilters` for `invoicemonk.com/verify/*` and `/invoice/*`, so https links open the app. Also reconcile the receipts share URL (`…/verify/<id>`) with the route (`/verify/receipt/<id>`). |

## 6. Schema / data decisions & seed

- **P1 — `tier_limits` seed:** `invoices_per_month` must be seeded for every tier or the invoice quota gate **fails open** (no limit). There is **no `clients` limit row**, so the free "1 client" cap **cannot be enforced** — add a `clients` feature row or drop that cap. (`src/features/billing/use-tier-gate.ts`.)
- **P1 — subscription tier vocabulary:** real enum is `starter | starter_paid | professional | business`; `src/providers/subscription-provider.tsx` is still a static free stub with a mismatched vocabulary — reconcile it to read the real `subscriptions` row.
- **P2 — free-form status vocabularies** the app maps defensively; confirm the values the backend writes: `account_status` (closure), `verification_status` / `document_verification_status`, `notifications.type` (icon map), `support_tickets.status`.
- **P2 — hashing:** `invoices.invoice_hash`/`compliance_hash`, `credit_notes.credit_note_hash`, `receipts.receipt_hash` are backend-computed; confirm they're generated on issue (the app only displays them). `credit_notes` has no line-items table and stores `amount` **positive** — confirm the sign convention.
- **P2 — verify-email OTP:** confirm `verifyOtp({ type: 'email' })` matches the Supabase auth config. (`src/app/(auth)/verify-email.tsx`.)
- **Deferred (no backend):** estimates/quotes (no `estimates` table), per-client default currency (no column), client multi-tags (using single `client_type`). Revisit only with a migration.

## 7. Suggested order
0. **⭐ `scan-document` edge function via Lovable AI Gateway** (§2) — the hero feature; the app is fully wired and waiting on it. Do this first.
1. **P0 buckets** (`verification-documents`, `payment-proofs`) + their RLS → unlocks KYC + payment proofs.
2. **P0 public verify** (anon RLS or `verify-invoice`) + **universal-link config** → makes verify/public-invoice links actually work for recipients.
3. **P0 `close-account`** confirmation + **`business_sensitive_data` RLS**.
4. **P0 customer referral** source (or keep referrals gated).
5. P1 edge functions (email-report / generate-export / export-user-data / cancel-subscription) + Stripe links + tier vocab.
6. P2 seeds, status vocabularies, constants.
