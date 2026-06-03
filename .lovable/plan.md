## Goal

Stop allocating system resources to users on the free Starter / starter_paid plans. Professional becomes the entry paid tier. Existing free-tier users get a 14-day grace period, then are locked to read-only until they upgrade.

## Scope

Pricing UI, plan-selection flow, signup default, billing/admin tooling, and an existing-user migration path. No new Stripe products needed — Professional and Business already exist.

---

## 1. Pricing & plan-selection UI (frontend)

- `src/pages/app/PlanSelection.tsx`
  - Drop `starter` and `starter_paid` from `tiers`, `FALLBACK_FEATURES`, `TIER_META`, and icons.
  - Remove `completeStarterSelection`, `confirmDowngradeToStarter`, the "Continue with Starter (free)" dialog, and any "free" copy.
  - Make Professional the default-selected/recommended tier. If a user lands here with no subscription, they must pick Pro or Business to continue — no skip-to-free path.
- `src/pages/app/Billing.tsx`
  - Remove the Starter card from the comparison grid; only show Professional and Business.
  - Hide the "current plan: Starter" badge variant; replace with the grace-period banner (see §4) when the active row is still `starter`/`starter_paid`.
- `src/components/app/UpgradePrompt.tsx` and any "upgrade to Pro" copy — confirm recommended tier is Professional (no "stay on free" CTA).
- `src/components/admin/SubscriptionDialog.tsx`
  - Drop the `starter` option from the tier picker so admins can no longer assign someone to Starter manually. Keep `starter_paid` hidden as well.
  - Note: this is the only place admins set tiers; existing rows in DB still display correctly.

## 2. Signup default (no more auto-Starter row)

Today a Postgres trigger inserts `('starter', 'active')` into `subscriptions` on new auth user (`20260131050339_…sql`). Change the behavior:

- Migration: rewrite the `handle_new_user` (or equivalent) trigger so it no longer creates a default subscription row. New users have **no subscription** until they complete Stripe checkout.
- Frontend signup flow: after email confirmation / first login, route to `/select-plan` and block all `/b/...` routes via `ProtectedRoute` until a paid subscription exists. Reuse the existing `TierGatedRoute` / `useSubscription` (treat "no subscription" the same as Starter for gating, but the only escape is paying).
- `useSubscription` keeps returning `tier: 'starter'` as a virtual default for gating math, but the DB row is gone.

## 3. Grace period + restriction for existing free users

- Migration: add `starter_grace_expires_at timestamptz` to `subscriptions` (nullable). Backfill: set to `now() + interval '14 days'` for every active row where `tier IN ('starter','starter_paid')`.
- New hook `useStarterGrace()` reads the current subscription; returns `{ inGrace, expiresAt, expired }` when the row tier is starter/starter_paid.
- `src/components/billing/PaymentIssueBanner.tsx` (or a new `StarterSunsetBanner`): persistent banner on every page for in-grace users — "Free plans end on {date}. Upgrade to keep creating invoices." with an Upgrade button to `/select-plan`.
- After expiry (`expired === true`), gate every creation surface to read-only:
  - Wrap `InvoiceNew`, `InvoiceEdit`, expense creation, receipt creation, client/vendor create dialogs, and the "Send" action with a check that opens the upgrade modal instead of submitting.
  - Sidebar "+ New" buttons become disabled with tooltip.
  - Read/export of existing data remains allowed so they can leave with their records.
- Optional one-time email via the existing lifecycle-campaigns infra (`process-lifecycle-campaigns`) announcing the sunset — keep it minimal: trigger on grace-set and on expiry.

## 4. Backend sync & reporting cleanup

- `supabase/functions/sync-subscriptions/index.ts`
  - When a Stripe sub is cancelled/expired, instead of downgrading the local row to `starter`, mark the local row `status='cancelled'` and leave `tier` as-is (or set to `null`). Removes false MRR signals and stops re-creating Starter entitlements.
  - Skip the `.neq("tier", "starter")` shortcut — it's no longer meaningful.
- `supabase/functions/admin-revenue-stats/index.ts` — exclude starter/starter_paid from the active-tier breakdown (they're no longer a product).
- `supabase/functions/track-auth-event/index.ts` — drop the `"starter"` fallback in Brevo PLAN attribute; send `"none"` instead so segmentation reflects unconverted signups.
- `tier_limits` / `pricing_regions` rows for `starter` and `starter_paid` stay in the DB (referenced by historical analytics) but are hidden from all UI surfaces.

## 5. We are NOT doing (out of scope)

- Removing the `starter` value from the `subscription_tier` enum (would break historical rows and many SQL functions). It stays as a legacy value, just unreachable from product surfaces.
- Refunds / proration for users who recently paid `starter_paid` — there are very few; handle case-by-case if anyone complains.

---

## Technical notes (for the engineer)

- The `subscription_tier` enum currently has `starter | starter_paid | professional | business`. We keep it intact; the cleanup is at the UI + signup + sync layer.
- `has_role`-style RLS and `check_tier_limit` already collapse "no entitlement" to starter behavior, so a missing subscription row will naturally fall through to the gating logic — confirm with a quick test before shipping.
- After §3 lands, run a one-off SQL update to set `starter_grace_expires_at` on all existing `tier IN ('starter','starter_paid') AND status='active'` rows.

## Rollout order

1. Migration: trigger change + `starter_grace_expires_at` column + backfill.
2. Edge function updates (sync-subscriptions, admin-revenue-stats, track-auth-event).
3. Frontend: PlanSelection / Billing / SubscriptionDialog cleanup, grace banner, read-only gates.
4. Verify: signup flow forces Pro/Business; existing test starter account sees banner; after manually expiring the grace date, creates are blocked.
