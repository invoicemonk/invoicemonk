# Restore pages when lazy-loaded bundles fail

## Goal
Prevent a single missing or stale page bundle from leaving users on the generic error screen across the app, and recover safely when deployment assets change.

## Plan
1. **Centralize lazy-page loading**
   - Add a shared lazy-import helper used by the route-level pages currently loaded with `React.lazy`.
   - Detect dynamic-import/chunk-fetch failures, retry the import once, and avoid infinite retry loops.
   - If the bundle still cannot be fetched, perform one guarded full-page reload so the browser can obtain the current app shell and asset manifest.

2. **Improve the visible recovery state**
   - Add a route-level fallback for failed page bundles that explains the page could not load and offers retry/reload actions.
   - Preserve the existing error boundary for real rendering errors and keep its route-reset behavior.
   - Keep the recovery UI branded with the official Invoicemonk logo and semantic design tokens.

3. **Prevent stale app-shell caching**
   - Update deployment headers so the HTML shell is revalidated while generated JavaScript assets remain safely cacheable.
   - Leave security headers and existing public routes intact.

4. **Validate the fix**
   - Run the existing tests and type/build checks.
   - Exercise several business routes, including Vendors, Invoices, Clients, and Expenses, with a browser check.
   - Confirm a failed chunk does not create an endless reload loop and that normal route navigation still works.

## Technical details
- Frontend and deployment-cache configuration only; no database or Supabase changes are required.
- The current browser error identifies `Vendors-Bcx2MKSH.js` as the failed dynamic import. The fix will cover all sibling lazy routes rather than patching Vendors alone.
- No user data or authentication behavior will be changed.
