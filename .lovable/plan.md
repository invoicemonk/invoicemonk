

# Fix: Hide Upgrade Modal for Platform Admins

## Problem
The `UpgradeModal` triggers for any user on the `starter` tier who has 2+ invoices. Platform admins also have starter-tier subscriptions, so they see the upgrade prompt — which makes no sense for admins who already have full access.

## Solution

Update `src/hooks/use-upgrade-triggers.ts` to check `usePlatformAdmin()` and suppress the modal when the user is a platform admin.

### File: `src/hooks/use-upgrade-triggers.ts`

- Import `usePlatformAdmin` from `@/hooks/use-platform-admin`
- Add `const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();`
- Update `showUpgradeModal` condition to include `&& !isPlatformAdmin`
- Include `adminLoading` in the `isLoading` return value
- Disable the invoice query when user is a platform admin (add `&& !isPlatformAdmin` to `enabled`)

This is a one-file change — no other files need modification.

