

# Move Team & Billing into Business Settings Tabs

## Rationale
Team management and Billing are infrequent, admin-level actions — not daily workflow. Consolidating them as tabs within Business Settings reduces sidebar items and groups all business management in one place.

**Sidebar after this change**: 9 main items + 1 settings item (Business Settings only) + Contact Support

## Changes

### 1. `src/components/app/BusinessSidebar.tsx`
- Remove the entire `teamNavItems` section and `settingsNavItems` Billing entry
- Keep only "Business Settings" in the settings group
- Remove `UserPlus`, `CreditCard` icon imports and `useTeamAccess` hook usage

### 2. `src/pages/app/BusinessProfile.tsx`
- Extend the tab switcher from `profile | audit-logs` to `profile | team | billing | audit-logs`
- Lazy-load `Team` from `@/pages/app/Team` and `Billing` from `@/pages/app/Billing`
- Conditionally show the "Team" tab only when `canManageTeam && hasTeamAccess` (same logic currently in sidebar)
- Render each component inline within its `TabsContent`

### 3. Routes (`src/App.tsx`)
- Keep `/b/:businessId/team` and `/b/:businessId/billing` routes for backward compatibility / direct URL access
- No route deletions

### Summary

| Item | Before | After |
|------|--------|-------|
| Team | Sidebar item (conditional) | Tab in Business Settings |
| Billing | Sidebar item | Tab in Business Settings |
| Sidebar settings group | 2 items + support | 1 item + support |

