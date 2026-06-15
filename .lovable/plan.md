## What the user reported

1. While filling out **Create Invoice**, the page appears to refresh roughly every 60 seconds, wiping the form.
2. After finally filling it in and clicking **Issue Invoice**, the page goes blank (white/black screen).

Both are urgent UX bugs. Below is what I found while reading the code and how I propose to fix them.

---

## Issue 1 — Form is wiped roughly every minute

### Likely root causes (multiple compounding)

1. **`handleIssue` / `handleSaveDraft` have no `try/catch`.** If any awaited call rejects, the unhandled error bubbles to the root Sentry `ErrorBoundary` in `src/main.tsx`, which renders `<p>Something went wrong</p>` — i.e. a near-blank page (Issue 2). When the user clicks a button mid-form, this can also unmount `InvoiceNew` and lose state.
2. **`BusinessLayout` hard-redirects on every render** when `currentBusiness.onboarding_step !== 'completed'`. `BusinessProvider`'s `setBaseBusiness(...)` runs every time the `businesses` query refetches (React Query defaults to `refetchOnWindowFocus: true` and no shared `staleTime`), producing a new `baseBusiness` object reference. If `onboarding_step` is briefly stale/undefined the user is yanked to `/onboarding/:businessId`, losing the form.
3. **`AuthContext.onAuthStateChange` calls `setUser/setSession` on every event (including `TOKEN_REFRESHED`)** and re-runs profile fetch. Combined with the React StrictMode double-mount we can see in the console (`OneSignal Init failed` and the auth-lock warning `Lock "lock:sb-…-auth-token" was not released within 5000ms`), this causes extra renders. The repeated lock warning is the smoking gun that the auth client is being re-initialized.
4. **`use-starter-grace` returns `undefined`** when the row is missing — React Query then logs `Query data cannot be undefined` (visible in the console logs at 21:30/21:31/21:33). On a refetch this can momentarily flip dependents' state.

### Proposed fixes

- **Wrap submit handlers in `try/catch`** in `src/pages/app/InvoiceNew.tsx` (`handleSaveDraft`, `handleIssue`) and surface a toast on failure instead of letting the error reach the global ErrorBoundary. Same audit for `InvoiceEdit.tsx`.
- **Stabilise `BusinessLayout`'s onboarding gate** so it only redirects after `loading` is `false` AND `currentBusiness` has actually loaded with a definite `onboarding_step`. Treat `null/undefined` as "still loading", not "incomplete".
- **Stop redirecting on transient refetches in `BusinessProvider`**: only call `setBaseBusiness` when the underlying business id changes (compare by id, not by reference). Also add `staleTime: 5 * 60 * 1000` and `refetchOnWindowFocus: false` to `['user-businesses']`, `['business-redirect']`, `['account-status']`, and `['starter-grace']` so they don't refetch mid-form.
- **Make `use-starter-grace` return `null` instead of `undefined`** so React Query stops warning and re-rendering.
- **Make `AuthContext.onAuthStateChange` no-op on `TOKEN_REFRESHED`** when `session.user.id` is unchanged (skip the profile re-fetch and the activity upsert; keep updating `setSession` only). This removes the cascade of renders every time Supabase refreshes the token.
- **Confirm the duplicate-mount source**: read `src/main.tsx` to check `StrictMode` and ensure we don't have a second Supabase client. If StrictMode is on in prod-like preview, leave it but make `AuthProvider`'s effect idempotent.

### How I'll verify

- Open the preview, log in, navigate to `/b/:id/invoices/new`, start typing, leave the tab for 2 minutes, switch back, and confirm the form state is intact.
- Watch the browser console for the `Lock … was not released` warning — it should disappear or appear only once.
- Watch React Query devtools (if not present I'll add a temporary `console.log` in BusinessProvider) to confirm `setBaseBusiness` no longer fires on every refetch.

---

## Issue 2 — Blank/white screen after "Issue invoice"

### Root cause

In `src/pages/app/InvoiceNew.tsx#handleIssue` (lines 505-606), `createInvoice.mutateAsync(...)` and `issueInvoice.mutateAsync(invoice.id)` are awaited with no `try/catch`. Any rejection (RLS denial, validation error, network blip, Stripe Connect 503, the existing `business-profile-guard` throwing, etc.) becomes an unhandled error inside a React event handler, which is caught by the root `Sentry.ErrorBoundary` in `src/main.tsx`. That boundary renders `<p>Something went wrong</p>` on a blank page — exactly the "page went black/white" symptom.

### Proposed fix

- Wrap both mutations in `try/catch`, show a `toast({ variant: 'destructive' })` with the error message, and stay on the form so the user doesn't lose their input.
- Apply the same pattern to `handleSaveDraft` and to `InvoiceEdit.tsx`'s save/issue handlers.
- Add an inline error fallback for the `InvoiceNew` route (a smaller Sentry boundary) so even if something else throws, the user lands on a "Something went wrong, your draft is safe" panel with a "Retry" button instead of a global blank page.
- After fixing, look at recent Supabase Edge Function logs / Postgres errors for that user's invoice attempts to confirm what the original mutation error actually was, so we can address the underlying validation issue (likely `business_profile_guard` or RLS).

### How I'll verify

- Reproduce by submitting an intentionally invalid invoice (e.g. unsaved client) and confirm a toast appears instead of a blank screen.
- Log in with the affected account, attempt to issue an invoice, and capture the real error from the toast/logs.

---

## Files I expect to touch

```text
src/pages/app/InvoiceNew.tsx        # try/catch + inline error boundary
src/pages/app/InvoiceEdit.tsx       # same pattern
src/components/app/BusinessLayout.tsx   # safer onboarding gate
src/contexts/BusinessContext.tsx    # id-based setBaseBusiness, query defaults
src/contexts/AuthContext.tsx        # ignore no-op TOKEN_REFRESHED
src/components/ProtectedRoute.tsx   # raise staleTime, disable focus refetch
src/hooks/use-starter-grace.ts      # return null, not undefined
```

No database migrations, no design changes.

## Out of scope

- The OneSignal "Can only be used on app.invoicemonk.com" warning (preview-only, harmless).
- The Tawk.to title-flicker every second — separate issue, only cosmetic.
- Rebuilding the onboarding flow further (separate thread).
