

# Replace Support Pages with Tawk.to Chat Trigger

## Approach
Remove the support ticket pages and replace the sidebar "Support" link with a button that opens the Tawk.to chat widget via `window.Tawk_API.maximize()`. This simplifies the support flow — one channel instead of two.

## Changes

### 1. Business Sidebar (`src/components/app/BusinessSidebar.tsx`)
- Replace the Support `<Link>` with an `onClick` handler that calls `window.Tawk_API?.maximize()`
- Keep the icon and label unchanged

### 2. Admin Sidebar (`src/components/admin/AdminSidebar.tsx`)
- Remove "Support Tickets" from `mainNavItems`
- Add a standalone "Support Chat" button that triggers `window.Tawk_API?.maximize()`

### 3. Remove Support Pages & Components
- Delete `src/pages/app/Support.tsx`
- Delete `src/pages/app/SupportTicket.tsx`
- Delete `src/components/support/SupportTicketForm.tsx`
- Delete `src/components/support/SupportTicketDetail.tsx`
- Delete `src/pages/admin/AdminSupport.tsx`

### 4. Remove Routes (`src/App.tsx`)
- Remove `/b/:businessId/support` and `/b/:businessId/support/:ticketId` routes
- Remove `/admin/support` route
- Remove corresponding imports

### 5. Hooks Cleanup
- Keep `src/hooks/use-support-tickets.ts` for now (the DB tables and edge functions remain intact — existing tickets aren't lost). Can be removed in a future cleanup pass.

### Notes
- Existing support ticket data in Supabase remains untouched — no migrations needed
- The Tawk.to widget is already loaded globally via `TawkTo` component in `App.tsx`
- `window.Tawk_API.maximize()` is the standard API call to open the chat window

