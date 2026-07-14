# Invoicemonk Mobile App — Claude Code Handoff Package

Goal: give Claude Code everything it needs to build a production-quality iOS + Android app that reuses the existing Supabase backend, ships a best-in-class **scan-a-receipt / scan-an-invoice** flow as the hero feature, and includes **full parity with the Invoicemonk web app — everything except the platform Admin area, partner portal, and other staff-only surfaces**.

No changes to existing web runtime code. All work lives in a new `mobile/` folder plus a few additive backend pieces (one storage bucket, one edge function, two small tables) that also benefit the web app.

---

## 1. Stack decision

- **Framework**: React Native via **Expo (SDK 54+)** with **expo-router** (file-based routing).
- **Language**: TypeScript, strict mode.
- **Backend client**: `@supabase/supabase-js` + `expo-secure-store` session persistence. Same project ref `skcxogeaerudoadluexz`, same anon key.
- **Data**: TanStack Query — mirror the web hook shape in `src/hooks/*` so patterns transfer.
- **UI**: NativeWind (Tailwind-for-RN) themed to InvoiceMonk teal `#1d6b5a`; shared design tokens from `src/index.css`.
- **Camera**: `expo-camera` + `expo-image-manipulator` (crop/rotate/compress). `react-native-vision-camera` reserved for later live edge-detect.
- **Files**: `expo-image-picker`, `expo-document-picker` (PDFs), `expo-print` (multi-page stapling).
- **Offline**: TanStack Query persist + `expo-sqlite` outbox for pending scans/uploads.
- **Push**: `expo-notifications` (APNs + FCM) → new `push_tokens` table.
- **Payments**: web checkout for v1 (Stripe already lives on web); "Manage subscription" opens a deep link to the web billing page. Avoids Apple/Google IAP for launch.
- **Observability**: Sentry RN + PostHog RN (reuse existing DSNs/keys).
- **Builds**: EAS Build + EAS Update (`development`, `preview`, `production` channels).

Alternative noted in handoff doc: Capacitor wrapper. Not recommended — the camera-first UX and offline scan queue are meaningfully better on native RN.

---

## 2. Feature scope — everything except admin

Full inventory the mobile app must ship, grouped as it appears in the InvoiceMonk web sidebar. Anything **not** on this list is intentionally out of scope for v1.

### Included (parity with web)

- **Auth**: email/password, Google sign-in, email verification, password reset, 30-min inactivity auto-logout, account deletion.
- **Onboarding**: free-tier signup (no paywall), business profile wizard, jurisdiction + currency selection, plan selection screen as an upgrade page (not a gate).
- **Dashboard**: KPIs, cashflow summary, receivables, profitability, compliance confidence, quick-setup checklist, banners (payment issue, starter sunset, immutability, FR e-invoicing, online payments).
- **Business switcher + multi-business** (`/b/:businessId/*` equivalent via route params).
- **Invoices**: list, filters, view, create/edit with line items, deposit invoices, credit notes, send dialog, PDF preview, mark paid, payment proofs, compliance artifacts, regulatory status, deep-link share to public invoice view.
- **Estimates / quotes** (if present in web) with conversion to invoice.
- **Clients**: list, add/edit, detail, segmentation tags, communication history.
- **Products & services**: list, add/edit, combobox use inside invoices.
- **Vendors**: list, add/edit, merge, detail, vendor picker inside expenses.
- **Expenses**: full CRUD, categories, tax tracking, recurring expenses, expense inbox.
- **Receipts**: list, view, verify, send receipt dialog, PDF download, search & storage.
- **Accounting**: chart of accounts read, financial reports read, tax report, disclaimers, period selector, jurisdiction badges, insight cards. (Full write parity where the web supports it.)
- **Payments**: online payments, payment methods (add/edit/list), payment history for invoices, orphaned-payment recovery.
- **Billing (self)**: current plan, tier limits, usage, "Upgrade" → opens web checkout, downgrade feedback dialog, cancellation, invoices/receipts for the subscription.
- **Currency accounts**: switcher, per-currency isolation (enforce the same `currency_account_id` rule as web).
- **Import**: CSV import wizard, migration wizard.
- **Notifications**: notification center, per-device push toggle, per-channel prefs.
- **Support**: Tawk.to chat (RN SDK) + support ticket read (deprecated on web but leave read-only), contact form.
- **Reports & exports**: email report dialog, export manifests, download.
- **Verification (business KYC)**: submit documents (photo capture), status view, Stripe Connect handoff via in-app browser.
- **Settings**: profile, business profile, verification documents, online payments settings, account closure, user preferences, accounting preferences, retention (read), audit log (read for the user's own business).
- **Referrals (customer-side)**: view your own referral link, share sheet, referral stats. (The partner/affiliate portal is excluded — see below.)
- **Public/verify links**: opening `/verify/invoice/:id`, `/verify/receipt/:id`, `/invoice/:id` deep links.
- **Marketing/legal**: opening SLA, privacy, terms in an in-app browser.

### Excluded from v1 (staff-only or explicitly out)

- **Platform Admin** (`/admin/*`) — dashboard, users, businesses, invoices, partners, security, verifications review, risk monitoring, notifications, feedback, audit logs, retention policies, invoice templates, regulatory submissions, billing admin, country modules, system settings.
- **Impersonation** (admin-only tool).
- **Partner/affiliate portal** (`/partner/*`) — commissions, links, payouts, referrals-as-partner, partner settings, partner dashboard. Partners can continue using the web app.
- **Admin notifications, admin fraud flags, admin retention policies, admin verification review, admin templates, admin country modules.**
- **In-app subscription purchases** (deferred; use web checkout for v1 to skip Apple/Google IAP review).

Rule of thumb Claude Code will apply: if a route lives under `/admin` or `/partner`, or a hook is prefixed `use-admin-*`, `use-partner-*`, `use-platform-admin`, `use-realtime-admin`, `use-impersonation`, it is out of scope.

---

## 3. Hero feature — Scan a receipt or invoice

Single top-level tab **Scan** with two modes: *Receipt* (default) and *Invoice*.

```text
Capture → Auto-crop & enhance → Preview → Upload (offline queue OK)
       → AI extract via edge fn → Review & edit fields with confidence bars
       → Save → Lands in Expenses inbox (receipt) or Invoices drafts (invoice)
```

Requirements:

- One-tap capture, torch, multi-page stapling into a single PDF.
- Auto edge-detect + perspective correction; user can re-crop.
- Compress to ≤1600px long edge, JPEG q80, uploaded to `receipt-scans/{businessId}/{uuid}.jpg`.
- **Offline-first**: queued in SQLite outbox, retried on connectivity; badge shows pending count.
- Extracted fields shown with per-field confidence bars (mirror `src/pages/marketing-shots/ReceiptsScanning.tsx`).
- Duplicate detection: perceptual image hash + vendor/date/amount match against last 90 days.
- "Bill this to a client / project" toggle so nothing reimbursable is lost — direct answer to the user's pain point.
- Push notification when extraction finishes if the user backgrounded the app; tapping deep-links to the review screen.

---

## 4. Backend additions (shared by web + mobile)

All additive. No breaking changes.

1. **Storage bucket** `receipt-scans` (private). RLS: business members read/write objects prefixed `businessId/…`.
2. **Table `push_tokens**` — `user_id, platform, token, device_id, last_seen_at`. RLS `auth.uid() = user_id`. GRANTs to authenticated + service_role.
3. **Table `scan_jobs**` — `id, business_id, user_id, source enum('receipt','invoice'), storage_path, status enum('pending','processing','done','failed'), extracted_json, confidence, error, timestamps`. RLS via `is_business_member`. GRANTs to authenticated + service_role.
4. **Edge function `scan-document**` (`verify_jwt = false`, validates JWT in code). Input: `{ storage_path, source, business_id }`. Calls **Lovable AI Gateway** with `google/gemini-2.5-flash` (already used per `mem://features/receipts/ai-scanning`). Normalizes vendor, date, currency, total, tax breakdown, line items, and (for invoices) invoice number / due date / bill-to. Writes result to `scan_jobs`. On client confirm, creates an `expense_inbox_items` row (receipt) or an `invoices` draft (invoice) so the web app sees them immediately.

No web UI changes required.

---

## 5. Repo layout to hand to Claude Code

```text
/mobile
  app/                                expo-router routes
    (auth)/sign-in.tsx
    (auth)/sign-up.tsx
    (auth)/verify-email.tsx
    (onboarding)/business-wizard.tsx
    (tabs)/index.tsx                  dashboard
    (tabs)/scan.tsx                   hero feature
    (tabs)/invoices/…
    (tabs)/estimates/…
    (tabs)/receipts/…
    (tabs)/expenses/…
    (tabs)/clients/…
    (tabs)/vendors/…
    (tabs)/products/…
    (tabs)/accounting/…
    (tabs)/reports/…
    (tabs)/notifications.tsx
    (tabs)/settings/…                 profile, business, billing, prefs, verification, closure
  src/
    lib/supabase.ts                   shared client w/ SecureStore adapter
    lib/scanning/                     edge-detect, perspective, compress, hash
    lib/offline-outbox.ts             SQLite queue
    features/scan/
    features/invoices/
    features/receipts/
    features/expenses/
    features/clients/
    features/vendors/
    features/products/
    features/accounting/
    features/billing/
    features/notifications/
    features/settings/
    hooks/                            mirrors web hooks (excluding admin/partner)
    theme/                            tokens mirroring src/index.css
  assets/
  app.json / eas.json
  README.md
/docs/mobile/
  CLAUDE.md                           master brief — the single entry point
  ARCHITECTURE.md
  SCANNING_SPEC.md
  BACKEND_CONTRACT.md
  DESIGN_TOKENS.md
  FEATURE_INVENTORY.md                the §2 list, kept in sync
```

---

## 6. Non-negotiable rules Claude Code must follow

Pulled from project memory so the mobile app doesn't drift:

- Brand is **Invoicemonk** (camelCase). Primary color `#1d6b5a`. Never hardcode colors — use tokens.
- **Currency-scoped accounts**: every money query filters by `currency_account_id`. No cross-currency aggregation.
- **Invoices owned by `business_id**`, not `user_id`.
- RLS everywhere. **Never ship the service-role key to the device.** All privileged work goes through edge functions using anon key + JWT.
- 30-minute inactivity auto-logout (app-state listener + timer).
- Free-tier defaults; no paywall at signup — mirror web onboarding.
- All AI calls go through the `scan-document` edge function → Lovable AI Gateway. No provider SDKs on the device.
- Push tokens revoked on sign-out.
- Nothing under `/admin` or `/partner` is exposed in the app; admin/partner-role users still see only the customer experience on mobile (they can use the web app for staff work).

---

## 7. `docs/mobile/CLAUDE.md` — master brief contents

Single file Claude Code reads first. Contains, in order:

1. Product one-pager: who/what/why. Receipts scanning to stop lost deductions & reimbursements.
2. Stack + folder layout (§1, §5).
3. Full feature inventory with the excluded list (§2).
4. Backend contract: Supabase URL, anon key, table list, RLS notes, edge-function signatures (§4).
5. Scan flow spec with acceptance criteria and text wireframes (§3).
6. Design tokens mirrored from `src/index.css`.
7. Coding standards: TS strict, TanStack Query key conventions, error boundaries, Sentry init, PostHog events matching the web funnel.
8. Build & release runbook: EAS project id placeholders, bundle ids `com.invoicemonk.app` (iOS) and `app.invoicemonk` (Android), signing, OTA channel strategy.
9. Test plan: Detox smoke tests for auth + scan happy path + create-invoice happy path.
10. Milestone checklist for Claude Code:
  - **M1** Bootstrap, auth, business switcher.
    - **M2** Scan flow end-to-end (hero).
    - **M3** Invoices + Clients + Products full CRUD.
    - **M4** Expenses + Receipts + Vendors + Accounting read.
    - **M5** Billing self-service, notifications, push, offline outbox, Sentry/PostHog.
    - **M6** Settings, verification, import, reports, referrals.
    - **M7** EAS internal build → TestFlight + Play Internal.

---

## 8. What executing this plan will produce

1. Migration adding `push_tokens`, `scan_jobs`, storage bucket + RLS + GRANTs.
2. Edge function `scan-document` deployed.
3. Full `/mobile` Expo project scaffolded with routing, theme, Supabase client, offline outbox.
4. Scan flow implemented end-to-end against the edge function.
5. `docs/mobile/CLAUDE.md` + `ARCHITECTURE.md` + `SCANNING_SPEC.md` + `BACKEND_CONTRACT.md` + `DESIGN_TOKENS.md` + `FEATURE_INVENTORY.md` written so Claude Code can autonomously ship the remaining screens milestone-by-milestone.
6. `eas.json` with three build profiles + README build/release runbook.

Zero changes to existing web pages, routes, or components.

---

## 9. Confirm before I switch to build mode

- OK with **Expo + React Native** (recommended) rather than Capacitor?
- Bundle IDs `com.invoicemonk.app` (iOS) / `app.invoicemonk` (Android) — or do you already own others?
- v1 uses **web checkout for upgrades** (fastest, no IAP review). OK to defer native IAP?
- OK to enable Lovable AI Gateway for the `scan-document` function (same Gemini 2.5 Flash the web already uses)?