# Architecture

## Repo layout

```text
/mobile
  app/                              expo-router routes (file-based)
    _layout.tsx                     root: providers, session bootstrap, deep links
    (auth)/
      _layout.tsx
      sign-in.tsx
      sign-up.tsx
      verify-email.tsx
      forgot-password.tsx
      reset-password.tsx
    (onboarding)/
      _layout.tsx
      business-wizard.tsx
    (tabs)/
      _layout.tsx                   bottom tab bar
      index.tsx                     dashboard
      scan.tsx                      HERO — camera capture
      invoices/
        index.tsx                   list
        [id].tsx                    detail
        new.tsx                     create
      estimates/
      receipts/
      expenses/
      clients/
      vendors/
      products/
      accounting/
      reports/
      notifications.tsx
      settings/
        index.tsx
        profile.tsx
        business.tsx
        billing.tsx
        preferences.tsx
        verification.tsx
        currency-accounts.tsx
        closure.tsx
    verify/
      invoice/[id].tsx              public verification
      receipt/[id].tsx
  src/
    lib/
      supabase.ts
      theme.ts
      analytics.ts                  PostHog wrapper
      sentry.ts
      deep-links.ts
      inactivity.ts                 30-min auto-logout
      tier-limits.ts                mirrors web use-tier-features
      scanning/
        capture.ts
        crop.ts
        compress.ts
        hash.ts
        outbox.ts                   SQLite queue
    features/
      scan/
      invoices/
      receipts/
      expenses/
      clients/
      vendors/
      products/
      accounting/
      billing/
      notifications/
      settings/
    hooks/                          mirrors ../../src/hooks/* (customer-only)
    integrations/
      supabase/
        types.ts                    generated types (same schema as web)
    theme/
      tokens.ts
      dark.ts
  assets/
    icon.png
    splash.png
    adaptive-icon.png
  app.json
  eas.json
  package.json
  tsconfig.json
  README.md
```

## Providers (root `_layout.tsx`)

```tsx
<SafeAreaProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BusinessProvider>            {/* current business id + switcher */}
        <CurrencyAccountProvider>   {/* current currency account */}
          <SubscriptionProvider>    {/* tier + limits */}
            <NotificationsProvider> {/* push token registration */}
              <InactivityWatcher/>  {/* 30-min auto-logout */}
              <Stack />
              <Toaster />
            </NotificationsProvider>
          </SubscriptionProvider>
        </CurrencyAccountProvider>
      </BusinessProvider>
    </AuthProvider>
  </QueryClientProvider>
</SafeAreaProvider>
```

Mirror the web providers 1:1 in behavior — reuse the same names so patterns
transfer.

## Navigation

- `expo-router` with typed routes.
- Bottom tab bar: Dashboard, Invoices, **Scan (center FAB)**, Expenses, More.
- "More" opens a modal drawer with the rest of the sections.
- Business + currency-account switcher live in the header, matching the web.

## Data layer

- **TanStack Query** for every read.
- Query keys must include `businessId` and `currencyAccountId`:
  `['invoices', businessId, currencyAccountId, filters]`.
- Mutations invalidate specific keys, never a bare `['invoices']`.
- Persist the query cache with `@tanstack/query-async-storage-persister` so
  the app opens instantly with cached data offline.

## Offline strategy

Two layers:

1. **Read cache** — TanStack Query persisted to AsyncStorage. Users can open
   the app offline and see the last-known state.
2. **Write outbox** — SQLite table `mutation_outbox`:
   ```
   id, type, payload_json, created_at, attempts, last_error
   ```
   Every mutation goes through `enqueueMutation()` which either fires
   immediately (online) or queues (offline). A background worker retries
   with exponential backoff when `NetInfo` says we're back online.

The scan flow uses its own `scan_outbox` table because it needs to hold
binary blobs and file paths.

## Auth session

- Restored on cold start via `supabase.auth.getSession()`.
- `onAuthStateChange` listener updates `AuthContext`.
- SecureStore holds the session token (fallback to AsyncStorage for tokens
  over 2KB — see `BACKEND_CONTRACT.md`).

## Inactivity auto-logout

```ts
// src/lib/inactivity.ts
// Reset a 30-minute timer on every user interaction and on app-state
// transitions to 'active'. On expiry: supabase.auth.signOut() + navigate
// to /sign-in.
```

Mirrors web `mem://` core rule.

## Push notifications

1. On sign-in: request permission, get Expo push token.
2. `upsert` into `push_tokens` (`user_id`, `platform`, `token`, `device_id`).
3. Handle foreground notifications with `expo-notifications` handler; deep
   link on tap.
4. On sign-out: delete the row for this `device_id`, then `supabase.auth.signOut()`.

## Observability

- **Sentry RN** — `Sentry.init` in root layout, `Sentry.setUser` on auth
  change, `Sentry.captureException` in every mutation `onError`.
- **PostHog RN** — event names match `../../src/lib/funnel-tracking.ts`.
  Identify on sign-in, reset on sign-out.

## Deep linking

`app.json`:
```json
{
  "scheme": "invoicemonk",
  "ios": { "associatedDomains": ["applinks:invoicemonk.com", "applinks:app.invoicemonk.com"] },
  "android": { "intentFilters": [{ "action": "VIEW", "data": [{ "scheme": "https", "host": "invoicemonk.com" }], "category": ["BROWSABLE", "DEFAULT"], "autoVerify": true }] }
}
```

Handled routes:
- `invoicemonk://scan/review/<jobId>`
- `invoicemonk://invoices/<id>`
- `invoicemonk://expenses/<id>`
- `https://invoicemonk.com/invoice/<id>` → in-app public view
- `https://invoicemonk.com/verify/(invoice|receipt)/<id>` → in-app verify screens

## In-app browser

`expo-web-browser` for anything we don't render natively in v1:
- Stripe upgrade checkout
- Stripe Connect KYC handoff
- Legal pages (SLA, privacy, terms)
- Manage billing on web

## Error boundaries

Every route has an error boundary via expo-router's `+not-found.tsx` and
per-stack `ErrorBoundary` files. Errors bubble to Sentry.
