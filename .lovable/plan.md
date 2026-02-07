

# Plan: Fix Business Settings Showing Wrong Business Data

## ✅ IMPLEMENTED

All 5 files have been updated to use `useBusiness()` from `BusinessContext` instead of `useUserBusiness()`:

| File | Status |
|------|--------|
| `src/pages/app/BusinessProfile.tsx` | ✅ Fixed |
| `src/pages/app/ClientEdit.tsx` | ✅ Fixed |
| `src/pages/app/Expenses.tsx` | ✅ Fixed |
| `src/pages/app/accounting/AccountingOverview.tsx` | ✅ Fixed |
| `src/pages/app/accounting/AccountingExpenses.tsx` | ✅ Fixed |

## Testing

1. Create a new business from the Business Switcher
2. Navigate to the new business's settings page
3. Verify the settings form shows empty/default values (not the old business's data)
4. Update and save the new business's settings
5. Switch back to the original business and verify its settings are intact


