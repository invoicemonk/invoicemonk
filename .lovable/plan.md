

# Plan: Fix Business Settings Showing Wrong Business Data

## Problem Identified

When you create a new business and navigate to its settings page, the **old business data** is still displayed. This happens because several pages inside the `/b/:businessId/...` route are using the wrong hook to fetch business data.

### Root Cause

The pages are using `useUserBusiness()` from `src/hooks/use-business.ts` which always fetches the **default business** (or first business). They should instead use `useBusiness()` from `BusinessContext` which returns the **current business** based on the URL.

### How Business Routing Works

```text
URL: /b/84e9244b-9345-4ce1-8e11-8f98a72cc509/settings
         └─ businessId from URL parameter

BusinessContext reads this businessId and sets currentBusiness correctly.
But BusinessProfile.tsx ignores this and calls useUserBusiness() which
returns the DEFAULT business, not the one in the URL.
```

## Files Affected

| File | Current Hook | Should Use |
|------|-------------|------------|
| `src/pages/app/BusinessProfile.tsx` | `useUserBusiness()` | `useBusiness()` |
| `src/pages/app/ClientEdit.tsx` | `useUserBusiness()` | `useBusiness()` |
| `src/pages/app/Expenses.tsx` | `useUserBusiness()` | `useBusiness()` |
| `src/pages/app/accounting/AccountingOverview.tsx` | `useUserBusiness()` | `useBusiness()` |
| `src/pages/app/accounting/AccountingExpenses.tsx` | `useUserBusiness()` | `useBusiness()` |

## Implementation Details

### 1. Update BusinessProfile.tsx

**Before:**
```typescript
import { useUserBusiness, useUpdateBusiness, ... } from '@/hooks/use-business';

export default function BusinessProfile() {
  const { data: business, isLoading: isLoadingBusiness } = useUserBusiness();
```

**After:**
```typescript
import { useUpdateBusiness, ... } from '@/hooks/use-business';
import { useBusiness } from '@/contexts/BusinessContext';

export default function BusinessProfile() {
  const { currentBusiness: business, loading: isLoadingBusiness } = useBusiness();
```

### 2. Update ClientEdit.tsx

**Before:**
```typescript
import { useUserBusiness } from '@/hooks/use-business';
const { data: business } = useUserBusiness();
```

**After:**
```typescript
import { useBusiness } from '@/contexts/BusinessContext';
const { currentBusiness: business } = useBusiness();
```

### 3. Update Expenses.tsx

Same pattern - replace `useUserBusiness()` with `useBusiness()` from context.

### 4. Update AccountingOverview.tsx

Same pattern - replace `useUserBusiness()` with `useBusiness()` from context.

### 5. Update AccountingExpenses.tsx

Same pattern - replace `useUserBusiness()` with `useBusiness()` from context.

## Why This Fixes the Issue

1. `BusinessContext` (provided by `BusinessLayout`) extracts `businessId` from the URL: `/b/:businessId/...`
2. It then fetches and sets `currentBusiness` based on that URL parameter
3. When pages use `useBusiness()`, they get the business from the URL
4. When switching businesses or creating a new one, the URL changes and the context updates

## Technical Notes

- The `BusinessLayout` wraps all `/b/:businessId/*` routes with `BusinessProvider`
- `useBusiness()` throws an error if used outside `BusinessProvider` (which is correct behavior)
- The update/create mutations in `use-business.ts` remain unchanged - only the read hook changes

## Testing After Implementation

1. Create a new business from the Business Switcher
2. Navigate to the new business's settings page
3. Verify the settings form shows empty/default values (not the old business's data)
4. Update and save the new business's settings
5. Switch back to the original business and verify its settings are intact

