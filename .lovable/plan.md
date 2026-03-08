

# Simplify Sidebar: Move Notifications, Audit Logs & Analytics

## Summary
Remove 3 items from the business sidebar:
- **Notifications** — already in the header bell icon; remove from sidebar entirely
- **Audit Logs** — add as a new tab in Settings (the `/settings` page already uses tabs)
- **Analytics** — add as a new tab in Reports (Reports already uses tabs for categories)

Keep routes working for direct URL access but remove sidebar clutter (12 → 9 main items).

## Changes

### 1. `src/components/app/BusinessSidebar.tsx`
- Remove `Notifications`, `Audit Logs`, and `Analytics` from `mainNavItems` array
- Remove unused icon imports (`Bell`, `PieChart`, `History`)

### 2. `src/pages/app/Reports.tsx` — Add Analytics tab
- Add a top-level tab toggle: "Reports" | "Analytics"
- When "Analytics" is selected, render the existing `Analytics` component inline
- Import `Analytics` from `@/pages/app/Analytics`
- Keep the existing Reports content as the default tab

### 3. `src/pages/app/Settings.tsx` — Add Audit Logs tab
- Add a new tab: "Audit Logs" (with History icon) to the existing TabsList
- When selected, render the existing `AuditLogs` component inline
- Import `AuditLogs` from `@/pages/app/AuditLogs`

### 4. Routes (`src/App.tsx`)
- Keep `/b/:businessId/analytics`, `/b/:businessId/audit-logs`, and `/b/:businessId/notifications` routes intact for backward compatibility and direct URL access
- No route changes needed

### 5. `src/pages/app/BusinessProfile.tsx` — Add Audit Logs tab
- Check if business settings (not account settings) also needs the audit logs tab — the sidebar links to `/b/:businessId/settings` which renders `BusinessProfile`, not `Settings`
- Need to verify which settings page should get the Audit Logs tab

Let me verify the correct settings page.

### Routing clarification
- `/b/:businessId/settings` → `BusinessProfile` (business-level settings)
- `/settings` → `Settings` (account-level settings)

Audit Logs are business-scoped, so the tab should go in `BusinessProfile`, not account `Settings`.

## Revised Changes

| File | Change |
|------|--------|
| `BusinessSidebar.tsx` | Remove Notifications, Audit Logs, Analytics from nav |
| `Reports.tsx` | Add top-level "Reports \| Analytics" tab switcher; embed Analytics component |
| `BusinessProfile.tsx` | Add "Audit Logs" tab; embed AuditLogs component |
| `App.tsx` | No changes (keep routes for direct access) |

