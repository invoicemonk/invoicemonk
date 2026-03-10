

# Real-Time Disposable Email Blocking on Input

## Problem

Currently, the disposable email check only runs on form submission (via Zod `.refine()`). Users can type a disposable email and only see the error after clicking "Create account." Industry standard is to show the warning **instantly as the user types** (on blur or on change with debounce).

## Approach

Add real-time validation to the email field that checks against the disposable blocklist as the user types, showing an inline warning immediately — before they ever hit submit.

### Changes to `src/pages/app/Signup.tsx`

1. **Watch the email field** with `form.watch('email')` (already used for password) and run `isDisposableEmail()` on every change
2. **Add a `useEffect`** (or derive inline) that sets a local `isDisposable` boolean when the watched email value contains a `@` and the domain matches the blocklist
3. **Show an immediate inline warning** below the email input — a red/destructive alert with a shield icon: *"Temporary/disposable emails are not allowed. Please use a permanent email address."* — this appears the moment a blocked domain is detected, without waiting for form submission
4. **Visually mark the input** — add a red border (`border-destructive`) and a red icon swap on the email input when a disposable domain is detected
5. **Disable the submit button** when `isDisposable` is true (in addition to the existing `isLoading` check)
6. **Keep the Zod `.refine()`** as a fallback for edge cases

### UX Details

- Check triggers on every keystroke after `@` is present (lightweight — it's a `Set.has()` lookup, no debounce needed)
- Warning appears/disappears instantly as the user edits
- Submit button shows disabled state with clear visual connection to the email error

### Files Changed

| File | Change |
|---|---|
| `src/pages/app/Signup.tsx` | Add real-time disposable email detection with instant inline warning and submit button disabling |

