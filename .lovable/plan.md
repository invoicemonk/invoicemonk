

# Auto-Logout After 30 Minutes of Inactivity

## Approach

Create a custom hook `useIdleTimeout` that tracks user activity (mouse, keyboard, scroll, touch) and automatically logs the user out after 30 minutes of inactivity, redirecting them to the login page with a message explaining why.

## Changes

### 1. Create `src/hooks/use-idle-timeout.ts` (new)

- Track last activity timestamp via `mousemove`, `keydown`, `scroll`, `touchstart` events
- Use throttled event listeners (update at most every 30 seconds to avoid performance overhead)
- Run a check interval every 60 seconds comparing `Date.now()` against last activity
- When idle time exceeds 30 minutes:
  - Call `signOut()` from AuthContext
  - Navigate to `/login?reason=idle` 
- Clean up listeners and interval on unmount

### 2. Update `src/contexts/AuthContext.tsx`

- Import and invoke `useIdleTimeout` inside `AuthProvider`, so it runs globally for all authenticated users
- Only activate when `user` is not null

### 3. Update `src/pages/app/Login.tsx`

- Check URL for `?reason=idle` query parameter
- If present, show an info toast or inline message: "You were logged out due to inactivity. Please sign in again."

### Technical Notes

- The 30-minute timeout is client-side only (no server changes needed)
- Supabase's `autoRefreshToken` keeps the session alive server-side while the tab is open, so this complements that by handling true user inactivity
- Events are throttled to minimize performance impact
- The hook is a no-op when the user is not authenticated

