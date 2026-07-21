# Align Invoicemonk backend to the live mobile app contract

Goal: reconcile the shared Supabase backend to the literal contracts the already-shipped mobile app uses. Mobile calls cannot change, so backend must match names, request bodies, and response keys exactly.

## Current state (verified this turn)

- **Edge functions present**: `scan-document`, `send-invoice-email`, `send-receipt-email`, `generate-receipt-pdf`, `generate-report`, `generate-tax-report`, `export-records`, `verify-invoice`, `verify-receipt`, `view-invoice`, Stripe/Paystack, cron functions with `x-cron-secret`, `list-stripe-payments`.
- **Missing functions the app calls**: `generate-export`, `export-user-data`, `revenuecat-webhook`. (`email-report` already exists but its request body differs from the app's contract.)
- **Buckets**: `receipt-scans`, `verification-documents`, `payment-proofs`, `expense-receipts`, `expense-inbox`, `invoice-pdfs`, `receipt-pdfs`, `accounting-reports` all private. Only SELECT policies exist on `verification-documents` and `payment-proofs` for business members — INSERT/UPDATE/DELETE for owners are missing.
- `**tier_limits**` seeded for `starter`, `starter_paid`, `professional`, `business`.
- `**subscriptions**` has `user_id, business_id, tier, status, current_period_*, stripe_customer_id, stripe_subscription_id, pricing_region, billing_currency, starter_grace_expires_at`. No RevenueCat columns yet.
- `**export_manifests**` columns: `id, export_type, actor_id, actor_email, actor_role, business_id, scope, record_count, integrity_hash, format, timestamp_utc, source_ip, user_agent` — no `file_url` yet (the app expects a retrievable URL).
- `**scan-document**` already returns `{ job_id, status, extracted, confidence }`; the extracted schema uses `line_items[].amount` and includes a top-level `confidence` from the model — but no `field_confidence`, and prompt currently asks for `unit_price` (harmless — `amount` is present).

## Contract diffs the app breaks on (must shim)


| Function               | Current                                                                          | App expects                                                                                                              | Fix                                                                                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email-report`         | body: `{ report_title, report_data, recipient_email, format, year }`             | `{ business_id, currency_account_id, period, start_date, end_date, format, recipient_email }`                            | Rewrite handler: accept the new body, call the same code path as `generate-report`/`export-records` to produce data, then email it. Keep backward-compat by also accepting the old body when `report_title` is present.                                  |
| `generate-export`      | does not exist                                                                   | `{ business_id, currency_account_id, period, start_date, end_date, format }` → `{ file_url, manifest_id, record_count }` | New function. Delegates to the same export logic as `export-records`, uploads the generated CSV/JSON to a new private `exports` bucket at `${businessId}/${manifestId}.${ext}`, returns a signed URL (24h) and writes a manifest row.                    |
| `export-user-data`     | does not exist                                                                   | `{}` (JWT identifies user) → `{ file_url }`                                                                              | New function. Aggregates the caller's businesses, invoices, expenses, clients, vendors, receipts, notifications into one JSON bundle; uploads to `exports` bucket at `user/${userId}/gdpr-${ts}.json`; returns a signed URL and emails a copy via Brevo. |
| `scan-document`        | `{ job_id, status, extracted, confidence }` with `extracted.line_items[].amount` | Same, plus `field_confidence: Record<string, number>`                                                                    | Ask the model to also emit `field_confidence`; if missing, synthesize `{}`. Keep response shape otherwise identical.                                                                                                                                     |
| `generate-report`      | Returns per-report-type payload                                                  | Must also expose top-level `{ income, expenses, invoice_count, expense_count }` for the dashboard summary report         | Add `report_type: 'summary'` branch (or default when omitted) that returns those four keys directly on the response body. Leave existing report types unchanged.                                                                                         |
| `generate-tax-report`  | Returns HTML/CSV                                                                 | Must expose `{ missing_tax_rate_count, missing_receipt_count, total_expense_count }` in JSON                             | Add a `format: 'json'` branch returning those three counts alongside existing HTML/CSV output. Default remains `print`.                                                                                                                                  |
| `generate-receipt-pdf` | Returns `{ success, pdf }`                                                       | `{ base64 }` or `{ pdf }`                                                                                                | Response already has `pdf`; also mirror as `base64` for the mobile shape. Additive, no breaking change.                                                                                                                                                  |
| `send-invoice-email`   | body allows extras                                                               | Must accept minimum `{ invoice_id, recipient_email, custom_message? }`                                                   | Verify current handler treats extra fields as optional — no code change if `additional_recipients` etc. are optional (they are).                                                                                                                         |
| `send-receipt-email`   | body: `{ receipt_id, recipient_email, custom_message?, app_url? }`               | `{ receipt_id, recipient_email }`                                                                                        | Already compatible. No change.                                                                                                                                                                                                                           |


## Subscriptions write model (RevenueCat webhook)

The mobile app reads `subscriptions` by `business_id`. Rules the webhook must follow:

- **Owner-only.** Resolve `app_user_id` → `auth.uid()` → the single business where the user is an **owner** (`business_members.role = 'owner'`). RevenueCat purchases are individual App Store/Play accounts, so we bind to the user's owned business.
- **Multi-owner tiebreak.** If the user owns more than one business, apply to the **oldest owned business** (`min(business_members.created_at)`). Log a `SUBSCRIPTION_AMBIGUOUS` audit_logs entry with all owner business_ids so support can reassign manually if needed.
- **No owned business.** Reject the webhook with a 202 + audit log entry `SUBSCRIPTION_UNASSIGNED` (RevenueCat should not retry indefinitely). This covers members-only accounts that shouldn't be billing owners anyway.
- Upsert on `(user_id, business_id)`; every row written has a non-null `business_id`.

### Ask: is the "oldest owned business" tiebreak acceptable? 

If the app expects a different rule (e.g. the "active" business the user last opened), tell me now — this is the only ambiguous piece. **Yes, use the "oldest owned business" tiebreak. It's correct.**

## Changes

### 1. Storage RLS (migration)

Add business-membership INSERT/UPDATE/DELETE policies on `storage.objects` for `verification-documents`, `payment-proofs`, `expense-receipts`, `expense-inbox`, `receipt-scans` where missing. Path convention `${businessId}/…`. Create new private `exports` bucket with member-scoped SELECT policy.

### 2. `revenuecat-webhook` (new function)

- `verify_jwt = false`; validates `Authorization: Bearer $REVENUECAT_WEBHOOK_SECRET`.
- Handles `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `PRODUCT_CHANGE`, `BILLING_ISSUE`, `UNCANCELLATION`.
- Resolves owner business (rule above), maps `product_id` → tier, upserts `subscriptions` with `user_id`, `business_id`, `tier`, `status`, `current_period_start/end`, `store`, `revenuecat_app_user_id`, `revenuecat_product_id`.
- Add columns to `subscriptions`: `revenuecat_app_user_id text`, `revenuecat_product_id text`, `store text`.
- Write `SUBSCRIPTION_UPDATED` audit log.

### 3. Missing function wrappers

- `generate-export/index.ts`: JWT auth → membership check → run `export-records` logic → upload to `exports` bucket → insert `export_manifests` row → return `{ file_url (signed 24h), manifest_id, record_count, integrity_hash }`. Add `file_url text` column to `export_manifests`.
- `export-user-data/index.ts`: JWT auth → build user bundle → upload to `exports/user/${userId}/…` → email link via Brevo → return `{ file_url }`.
- Extract shared export logic from `export-records/index.ts` into `_shared/export-core.ts` so `generate-export` and `export-user-data` reuse it.

### 4. Shims to existing functions

- `email-report`: replace request handling to accept the app's contract; internally reuse `generate-report` / `export-records` logic. Keep old body shape supported for the web `EmailReportDialog` (detect by presence of `report_title`).
- `scan-document`: append `"field_confidence": { <field>: 0-100 }` to both prompts; default to `{}` when the model omits it. Response gains `field_confidence`.
- `generate-report`: add `summary` branch returning `{ income, expenses, invoice_count, expense_count }` at top-level (backwards compatible — existing branches untouched).
- `generate-tax-report`: when `format === 'json'`, return `{ missing_tax_rate_count, missing_receipt_count, total_expense_count, currency, jurisdiction }` and skip HTML/CSV rendering.
- `generate-receipt-pdf`: mirror `pdf` field as `base64` in the response (both keys present).

### 5. `tier_limits` reconciliation

Idempotent upsert to guarantee every key in the mobile brief exists for all four tiers.

### 6. Secrets

Request `REVENUECAT_WEBHOOK_SECRET` via `add_secret` after functions ship. `BREVO_API_KEY` already present.

### 7. Docs

Update `docs/mobile/BACKEND_CONTRACT.md` with the three new functions, the storage-path convention, and the subscriptions business-resolution rule.

## Acceptance tests (Deno tests + curl-edge probes)

1. **Storage**: authenticated business member can PUT `${businessId}/x.jpg` in `verification-documents` and `payment-proofs`; non-member gets 403.
2. **Subscriptions**: RevenueCat sandbox INITIAL_PURCHASE flips `subscriptions.tier` for the buyer's owned business within one delivery; row has non-null `business_id`; second delivery is idempotent.
3. **Scan hero flow**: POST a real receipt image path to `scan-document`; response `.extracted.vendor`, `.extracted.date`, `.extracted.total` are non-null and `.field_confidence` is an object.
4. **Invoice email hero flow**: POST `send-invoice-email` for an issued invoice → response `success: true`; Brevo API returns 2xx; presentation-link points at the Brevo transactional log.
5. **Export flow**: POST `generate-export` → response `file_url` downloads a non-empty CSV whose row count matches `record_count`; `export_manifests` row inserted.
6. **GDPR export**: POST `export-user-data` → response `file_url` returns a JSON bundle containing the caller's businesses and invoices; email delivered.
7. **Report shims**: `generate-report` with `{ report_type: 'summary' }` returns the four keys; `generate-tax-report` with `format: 'json'` returns the three counts.

## Out of scope (P2 follow-up)

- Confirming vocabularies for `notifications.type`, `account_status`, `verification_status`, `support_tickets.status`, `*_hash` fields, and the sign convention for `credit_notes.amount`.
- No web UI changes.
- No changes to Stripe/Paystack behaviour.