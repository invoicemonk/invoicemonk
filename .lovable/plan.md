## What's happening

Every page inside `/b/:businessId/*` is wrapped in `BusinessLayout` → `BusinessLayoutContent`. That component currently does:

```
if (loading) return <Loader …/>           // full-screen spinner
if (error || !currentBusiness) return …   // Access Denied
return <Outlet />                         // the actual page
```

`loading` is `loadingBusinesses || loadingSubscription` from `BusinessContext`. Both are React-Query `isLoading` flags, which **flip back to `true` whenever the query key changes** (a brand-new query has no cached data yet).

Two things keep changing those keys / blanking the data in the background, every few seconds:

1. **`BusinessProvider`'s effect** (`src/contexts/BusinessContext.tsx` lines 206–241). The effect depends on the `businesses` array reference. Every time Supabase fires a `TOKEN_REFRESHED` / `SIGNED_IN` event (visible in the console logs as the recurring OneSignal "Init failed / Login failed / Tags added" trio), `AuthContext` calls `setSession(...)`, the user-businesses query is treated as stale by some consumer, and the effect re-runs. If the find for the URL `businessId` ever resolves to `undefined` for one render (e.g. the array is briefly empty during a background refetch), it falls into the `else` branch and calls `setBaseBusiness(null)` + `setError('Business not found…')`. That:
   - Flips `loading` (the `business-subscription` query restarts with a `null` key, then a new id), and
   - Renders the "Access Denied" screen for a frame.
   Both unmount `<Outlet />`, wiping form state and giving the visual "page just refreshed" effect.

2. **`BusinessLayoutContent` uses `loading` as a hard gate**. Even without bug #1, any future query-key change in `BusinessContext` (currency switch, subscription refetch, role change) momentarily flips `loading` back to `true` and tears down the whole page tree.

This matches the user's report: "in-app remount only, every account, every page."

The recurring `SIGNED_IN` events (~every 10–50 s in the logs) are the trigger; the layout's unmount-on-loading is the amplifier.

## Fix

### 1. `src/components/app/BusinessLayout.tsx`
Only block on the loader when we have **no business yet**. Once `currentBusiness` is non-null, keep the `<Outlet />` mounted across subsequent refetches:

```text
- if (loading) return <Loader/>;
- if (error || !currentBusiness) return <AccessDenied/>;
+ if (!currentBusiness && loading) return <Loader/>;
+ if (!currentBusiness) return <AccessDenied/>;
```

Same idea for the onboarding gate: only redirect when we have a definite `onboarding_step !== 'completed'` (already done) — keep it.

### 2. `src/contexts/BusinessContext.tsx`
Make the membership-resolution effect **sticky** so a transient empty/stale `businesses` array can't wipe `baseBusiness`:

- Skip the effect entirely while `loadingBusinesses` is true **or** `businesses.length === 0` and we already have a `baseBusiness`. Only clear `baseBusiness` when we positively know the user has zero memberships (`!loadingBusinesses && businesses.length === 0`).
- In the `businessId` branch, if `businesses.find(...)` is undefined but `loadingBusinesses` is still pending in the background (or businesses is empty), do **not** set the error or navigate — keep the current business.
- Remove `baseBusiness` and `currentRole` from the effect's dependency array (they're only read inside the id-guard; including them just re-runs the effect for no reason).
- Add `refetchOnWindowFocus: false` to the `business-subscription`, `business-sensitive`, and `tier-limits` queries (parity with `user-businesses`).
- Derive `loading` so it only reports the **initial** load: `loading = (loadingBusinesses && !baseBusiness) || (loadingSubscription && !subscription && !!baseBusiness?.id)`.

### 3. `src/contexts/AuthContext.tsx`
Avoid creating a fresh `session` reference on every `TOKEN_REFRESHED` when the access token hasn't actually changed:

- Track `lastAccessToken` alongside `lastUserId`.
- Only call `setSession(session)` when `session?.access_token !== lastAccessToken`.
- Only fire `loginUser` / `addTags` / activity upserts when `event === 'SIGNED_IN' && userChanged` — currently they fire on every `SIGNED_IN` repeat, which is what causes the recurring OneSignal log noise.

### 4. (Defensive) `src/hooks/use-platform-admin.ts`
Add `refetchOnWindowFocus: false` so the admin check doesn't oscillate either.

## What this does not change

- Routing, auth gating, subscription/tier logic, RLS — all untouched.
- The OneSignal "Can only be used on https://app.invoicemonk.com" warning stays (it's a domain restriction on preview, not a bug).
- No design / UI changes.

## Verification

1. Open the preview, navigate to `/b/:id/clients` (and `/invoices/new`). Watch for 60 s — the page should no longer flash to "Loading business…" / "Access Denied" and the invoice form should retain its values.
2. Console should no longer show repeating `[OneSignal] Login failed / Tags added` every ~30 s after the first one.
3. Token-refresh cycle (~55 min later, or by manually invalidating the JWT) should not remount the page tree.
