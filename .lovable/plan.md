

# Remove Non-Functional Search Bar from Dashboard Header

## Problem
The search input in `DashboardHeader` is purely decorative — typing in it does nothing. It wastes header space and misleads users.

## Change

### `src/components/app/DashboardHeader.tsx`
- Remove the `Search` icon import and `Input` import
- Remove the `<div className="relative hidden md:block">` wrapper containing the search input
- Keep only the `NotificationDropdown` in the right side of the header

Result: a cleaner header with just sidebar trigger, breadcrumb, and notifications.

