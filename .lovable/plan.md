# Fix the `/admin/notifications` error

## Goal
Restore the admin notification center so it renders safely with the notifications currently stored in the database, including older notification types, while keeping admin-only access and mark-as-read behavior intact.

## Plan
1. **Unify notification type handling**
   - Create one shared notification configuration/category map used by the admin hook, notification item, and notifications page.
   - Include the legacy types currently present in the database (`ADMIN_PAID_DOWNGRADE` and `SUPPORT_TICKET_REPLY`) so they are not treated inconsistently.
   - Keep a safe fallback for any future unknown type instead of allowing a data value to cause a render failure.

2. **Harden the admin notifications query and rendering**
   - Preserve the existing user, `business_id IS NULL`, and admin-type scoping.
   - Make category filters derive from the shared map rather than duplicated arrays.
   - Guard notification timestamps before formatting them, so a malformed or missing date cannot crash the page.
   - Keep the existing empty, loading, unread-only, mark-all-read, and navigation states.

3. **Validate the fix**
   - Run the application type check.
   - Exercise `/admin/notifications` with representative current and legacy notification rows, confirming the page renders, category tabs work, and no uncaught render error appears.
   - Verify that the notification dropdown remains compatible with the shared handling.

## Technical details
- Frontend-only change; no database migration is needed because the existing rows are valid data and the fix will make the UI tolerant of them.
- Use the existing semantic design tokens and UI primitives; do not change the admin layout or access-control model.
