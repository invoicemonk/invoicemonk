

# Fix: Unlock All Invoice Templates for Platform Admins

## Problem
The `useInvoiceTemplates` hook determines template availability purely by comparing the user's subscription tier against the template's `tier_required`. Platform admins typically have a `starter` tier subscription, so all higher-tier templates show as locked.

## Solution
Same pattern as the upgrade modal fix: import `usePlatformAdmin` and grant full access when `isPlatformAdmin` is true.

### File: `src/hooks/use-invoice-templates.ts`

In the `useInvoiceTemplates` hook:
1. Import `usePlatformAdmin` from `@/hooks/use-platform-admin`
2. Call `const { isPlatformAdmin } = usePlatformAdmin();`
3. Change the availability check on line 54 from:
   ```typescript
   const available = TIER_ORDER[tier] >= TIER_ORDER[template.tier_required as SubscriptionTier];
   ```
   to:
   ```typescript
   const available = isPlatformAdmin || TIER_ORDER[tier] >= TIER_ORDER[template.tier_required as SubscriptionTier];
   ```

Single line change in a single file.

