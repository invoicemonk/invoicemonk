# Tawk.to Engagement Triggers for Logged-In Users

## Overview

Add four behavioral triggers that programmatically open the Tawk.to widget and send a message from "Bami" to logged-in users at key moments. All triggers respect a session-wide "only one fires per session" lock and persist per-user state in `localStorage`.

## Architecture

```text
AuthProvider
  └── TawkIdentityProvider          (existing — identifies user to Tawk)
        └── TawkTriggersProvider    (NEW — wraps <Routes>, watches user + route)
              ├─ Pricing dwell timer       (route: /select-plan, 20s)
              ├─ Stuck-on-invoice timer    (routes: invoices/new, invoices/:id/edit, 3min)
              ├─ Return-visit timer        (any route, 15s, only if last_visit ≥ 10d ago)
              └─ Invoice milestone watcher (queries invoice count, fires at 5)
```

A shared helper `fireTawkMessage(userId, triggerKey, message, event?)` handles:
1. Session-lock check (`sessionStorage['tawk_trigger_fired']`)
2. Per-user lifetime/cooldown check (`localStorage['tawk_trigger_<key>_<userId>']`)
3. Waiting for `Tawk_API` readiness (reuse `waitForTawk` pattern from `use-tawk-identity.ts`)
4. `Tawk_API.maximize()` → `Tawk_API.sendMessage(message)` → optional `Tawk_API.addEvent(event.name, event.props)`
5. Marking both session lock and per-user state

## Files

### New
- **`src/hooks/use-tawk-triggers.ts`** — single hook orchestrating all four triggers. Reads `useAuth()`, `useLocation()`, and the user's invoice count via TanStack Query (reuse existing `useInvoices` aggregate or a lightweight `select count` query against `invoices` filtered by businesses the user owns).
- **`src/lib/tawk-triggers.ts`** — pure helpers: `waitForTawk`, `fireTawkMessage`, storage-key builders, session lock.

### Modified
- **`src/App.tsx`** — add `<TawkTriggersProvider>` inside `<BrowserRouter>` (must be inside Router so `useLocation` works), wrapping `<AnalyticsProvider>`. Hook only activates when `user` is present.

## Trigger Details

| # | Key | Route(s) | Delay | Cooldown | Message |
|---|---|---|---|---|---|
| 1 | `pricing_dwell` | `/select-plan` | 20s | once / session | "Hey — noticed you're checking out the Pro plan…" |
| 2 | `invoice_milestone_5` | any | on count=5 | once / lifetime | "You've sent 5 invoices on Invoicemonk — nice!…" + `addEvent('invoice_milestone', {count:5})` |
| 3 | `return_visit` | any | 15s | once / 30 days, requires last_visit ≥ 10d | "Welcome back! It's been a little while…" |
| 4 | `stuck_invoice` | `/b/:businessId/invoices/new` or `…/edit` | 3 min | once / session | "Taking a while to set this up?…" |

### Last-visit tracking (trigger 3)

Store `localStorage['tawk_last_visit_<userId>']` = ISO timestamp.
- On hook mount with a user: read previous value, then write `now`.
- If previous value exists AND `now - prev ≥ 10 days` AND `localStorage['tawk_return_visit_cooldown_<userId>']` is empty or older than 30d → start 15s timer.
- On fire: set cooldown stamp.

### Invoice count (trigger 2)

Use a single Supabase query at hook mount + on invoice-create invalidations:
```ts
supabase.from('invoices').select('id', { count: 'exact', head: true })
  .in('business_id', userBusinessIds)
```
Or, simpler: subscribe to the existing `useInvoices` query keys via `queryClient.getQueryCache()` and recompute total. To keep it isolated, the hook will run its own `useQuery(['tawk-invoice-count', user.id])` that joins through `business_members` → `invoices`. Fires once when count first observed at ≥5 AND lifetime flag absent.

### Session lock semantics

`sessionStorage['tawk_trigger_fired'] = '<triggerKey>'` set on first fire. Other triggers check this and skip. Cleared automatically when the tab closes. The "once per session" rule applies to triggers 1, 3, 4. Trigger 2 (milestone) is also session-blocked by other triggers but additionally has a lifetime flag.

### Tawk readiness & error handling

All firing wrapped in try/catch; if `Tawk_API.sendMessage` is unavailable (older widget version), fall back to `Tawk_API.maximize()` only. Never throw to React tree.

## Excluded routes

Do NOT run any timer on:
- `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`
- Public verify/invoice-view pages
- Admin routes (`/admin/*`) — admin users should not get sales prompts

Hook returns early if path matches the exclude list or `user` is null.

## Technical Notes

- All timers cleared in effect cleanup (route change, unmount, sign-out).
- `waitForTawk` reused from `src/hooks/use-tawk-identity.ts` — extract to `src/lib/tawk-triggers.ts` and import from both to avoid duplication.
- `Tawk_API` window typing already declared in `use-tawk-identity.ts`; extend it there to add `maximize`, `sendMessage`, `addEvent` (some already present).
- No DB changes required.
- No new dependencies.
