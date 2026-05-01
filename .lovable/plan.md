# Add Google Sign-In to Login & Signup

You've configured Google OAuth credentials in Supabase. Now we'll surface a "Continue with Google" button on both the Login and Signup screens.

## What I'll build

### 1. Shared `GoogleAuthButton` component
**New file:** `src/components/auth/GoogleAuthButton.tsx`

- Renders a styled outline button with the Google logo and "Continue with Google" label.
- Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard`, queryParams: { access_type: 'offline', prompt: 'consent' } } })`.
- Shows a loading spinner while redirecting.
- Shows a destructive toast on error.
- Accepts a `label` prop so we can use "Sign up with Google" on the signup page and "Continue with Google" on login.

### 2. Login page (`src/pages/app/Login.tsx`)
- Add the `GoogleAuthButton` above the email/password form.
- Add a horizontal "or continue with email" divider between the Google button and the form.

### 3. Signup page (`src/pages/app/Signup.tsx`)
- Add the `GoogleAuthButton` above the form with the same divider pattern.
- Note: Google-authenticated users skip email verification (Google already verified them). Existing `AuthContext` logic will route them through `/dashboard`. The pending referral code flow already runs on `SIGNED_IN`, so referral attribution still works for OAuth signups.

## Technical notes

- No DB changes required. Supabase handles OAuth user creation in `auth.users` automatically, and the existing `handle_new_user` trigger (which creates the `profiles` row) will fire for OAuth users too.
- `redirectTo` will land on `/dashboard`; `ProtectedRoute` + `AuthContext` handle subsequent routing (e.g., to `/select-plan` if needed).
- The existing Supabase Site URL / Redirect URL configuration in the Supabase dashboard must include the app origin (already set up since email auth works).

## Verification reminder

After this is live, confirm in the Supabase dashboard under **Authentication → URL Configuration** that the Site URL and Redirect URLs include the preview and production origins, otherwise Google sign-in will return a "requested path is invalid" error.
