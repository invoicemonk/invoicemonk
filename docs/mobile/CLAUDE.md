# InvoiceMonk Mobile — Master Brief for Claude Code

> Read this file first. It links to every other doc in `docs/mobile/`.

## 1. Product one-pager

InvoiceMonk is a compliance-first invoicing + accounting app used by small
businesses across 40+ jurisdictions. The web app already exists (React + Vite,
Supabase backend).

You are building the **iOS + Android** apps in `/mobile`. The single most
important feature is **scan a receipt or invoice from the phone camera** so
businesses stop losing tax deductions and reimbursements. Everything else in
the web app must also be available, minus the platform Admin area and the
Partner/affiliate portal.

Same Supabase backend (`skcxogeaerudoadluexz`). Same auth users. Same tables.
Same edge functions. Whatever the mobile user creates must show up in the web
app for the same business immediately, and vice-versa.

## 2. Stack

- **Expo SDK 54+** with **expo-router** (file-based).
- **TypeScript strict**.
- `@supabase/supabase-js` + `expo-secure-store` for session persistence.
- **TanStack Query** — mirror the web hook patterns in `../../src/hooks/*`.
- **NativeWind** (Tailwind for RN) themed to `#1d6b5a`.
- **expo-camera** + **expo-image-manipulator** for capture/crop/compress.
- **expo-image-picker**, **expo-document-picker**, **expo-print**.
- **expo-sqlite** as an offline outbox for pending scans and mutations.
- **expo-notifications** wired to the new `push_tokens` table.
- **Sentry RN** + **PostHog RN** (reuse web DSNs/keys).
- **EAS Build + EAS Update** — channels `development`, `preview`, `production`.

**Do NOT use** Capacitor, Firebase (except FCM), or any AI SDK on the device.
All AI goes through the `scan-document` edge function.

## 3. Feature inventory

See [`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md). Everything the web app
does, minus the excluded list. That doc is the definitive scope.

## 4. Backend contract

See [`BACKEND_CONTRACT.md`](./BACKEND_CONTRACT.md). Supabase URL, anon key,
table map, RLS rules, and the `scan-document` edge function signature.

## 5. Scan flow (hero feature)

See [`SCANNING_SPEC.md`](./SCANNING_SPEC.md). This is M2 and the reason the
app exists — treat it with the most care.

## 6. Design tokens

See [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md). Colors, spacing, typography
mirrored from the web `src/index.css`. Never hardcode colors.

## 7. Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Folder layout, navigation shape,
data-layer conventions, offline strategy, error/observability wiring.

## 8. Coding standards

- TypeScript strict. No `any` in checked-in code.
- TanStack Query keys are arrays: `['invoices', businessId, filters]`.
- Every mutation invalidates the specific query keys it affects.
- Errors: `Sentry.captureException(err, { extra: { ... } })` + toast.
- PostHog events must match the web funnel names in `src/lib/funnel-tracking.ts`.
- No hardcoded colors, spacing, or font sizes — use theme tokens.
- Every screen has: loading state (skeleton), empty state, error state, retry.
- Every list is paginated (Supabase default limit is 1000).
- Every mutation checks tier limits before calling Supabase (see web
  `use-tier-features.ts`).

## 9. Non-negotiable rules

Pulled from web project memory. Violating any of these is a bug:

1. Brand is **InvoiceMonk** (camelCase). Primary `#1d6b5a`.
2. **Currency-scoped accounts**: every money query filters by
   `currency_account_id`. Never aggregate across currencies.
3. **Invoices are owned by `business_id`**, not `user_id`.
4. RLS everywhere. **Never ship the service-role key to the device.**
5. 30-minute inactivity auto-logout (app-state listener + timer).
6. Free-tier defaults. No paywall at signup — mirror web onboarding.
7. All AI calls go through the `scan-document` edge function.
8. Push tokens revoked on sign-out (`DELETE FROM push_tokens WHERE device_id = ?`).
9. Nothing under `/admin` or `/partner` is exposed in the mobile app.
10. Admin/partner users on mobile see only the customer experience — no admin UI.

## 10. Build & release

- iOS bundle id: `com.invoicemonk.app`
- Android package: `app.invoicemonk`
- EAS project id: **TODO — create with `eas init`**
- OTA channels:
  - `development` — dev client, hot reload
  - `preview` — internal TestFlight + Play Internal, updated on every PR merge
  - `production` — App Store + Play Store

Runbook lives in `/mobile/README.md`.

## 11. Milestone checklist

Tick each off as you ship. Don't skip ahead.

- [ ] **M1** Bootstrap, auth (email + Google), business switcher, dashboard shell.
- [ ] **M2** Scan flow end-to-end (see `SCANNING_SPEC.md`). Hero feature. Must
      work offline (queue in SQLite).
- [ ] **M3** Invoices, Clients, Products/Services full CRUD.
- [ ] **M4** Expenses, Receipts, Vendors full CRUD. Accounting read-only.
- [ ] **M5** Billing self-service (view + "Upgrade" opens web checkout),
      notifications center, push notifications, offline outbox for all
      mutations, Sentry + PostHog wired.
- [ ] **M6** Settings (profile, business, verification, prefs, closure),
      import (CSV, migration), reports, referrals, currency accounts,
      compliance artifacts.
- [ ] **M7** EAS internal build → TestFlight + Play Internal. Detox smoke
      tests. Store listings.

## 12. Testing

- Unit: Vitest (co-locate `*.test.ts` next to files).
- Component: React Native Testing Library.
- E2E: Detox for scan happy path, auth happy path, create-invoice happy path.

## 13. Coordination with the web app

- Never edit files outside `/mobile/`, `/docs/mobile/`, or
  `/supabase/functions/scan-document/` without asking.
- If a new backend table is needed, add a Supabase migration and update
  `BACKEND_CONTRACT.md`. Both apps read the same schema.
- If a shared hook pattern in `../../src/hooks/*` changes meaning, mirror the
  change in `/mobile/src/hooks/*` in the same PR.
