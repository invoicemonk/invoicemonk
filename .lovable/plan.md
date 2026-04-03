

# Integrate AbstractAPI for Disposable Email Blocking

## Problem
The current static blocklist (~250 domains) is being bypassed -- new disposable email services appear constantly. AbstractAPI maintains a live, continuously updated database and can detect disposable emails the static list misses.

## Approach
Create an edge function that calls AbstractAPI's email validation endpoint. The signup form calls this function **on blur** (when the user leaves the email field) for a server-side check, while keeping the existing static blocklist as an instant first layer.

## Architecture

```text
User types email
  │
  ├─ Keystroke: instant static blocklist check (existing, stays)
  │
  └─ On blur (after @ present + valid format):
       │
       Frontend calls edge function "validate-email"
         │
         Edge function calls AbstractAPI
         https://emailvalidation.abstractapi.com/v1/?api_key=KEY&email=EMAIL
         │
         Returns { is_disposable: true/false, deliverable: ... }
         │
       Frontend shows warning + disables submit if disposable
```

## Changes

### 1. Add `ABSTRACTAPI_EMAIL_KEY` secret
Store the API key `72d05304adb849a5b513b553ae6d055c` as a Lovable-managed secret.

### 2. New edge function: `supabase/functions/validate-email/index.ts`
- Accepts `{ email: string }` POST body
- Validates input with Zod
- Calls `https://emailvalidation.abstractapi.com/v1/?api_key=${key}&email=${email}`
- Returns `{ is_disposable: boolean, deliverability: string, is_valid: boolean }`
- Falls back gracefully (returns `is_disposable: false`) if AbstractAPI is down, so signups aren't blocked by an API outage
- `verify_jwt = false` not needed -- use anon key auth from frontend

### 3. Update `src/pages/app/Signup.tsx`
- Add state: `apiDisposable`, `isValidatingEmail`
- On email field blur (only if email is valid format and passes static check): call the edge function
- Show a subtle loading spinner next to the email field while validating
- If AbstractAPI says disposable: show the same warning style as the static check, disable submit
- If AbstractAPI is unreachable: silently pass (don't block the user)
- Disable submit when `isDisposable || apiDisposable || isValidatingEmail`

### 4. Keep existing layers
- Static blocklist in `disposable-emails.ts` remains as instant first layer
- Database trigger on `profiles` table remains as server-side safety net
- AbstractAPI adds the dynamic, continuously-updated middle layer

## Files Changed

| File | Change |
|---|---|
| Secret: `ABSTRACTAPI_EMAIL_KEY` | Add API key as managed secret |
| `supabase/functions/validate-email/index.ts` | New edge function calling AbstractAPI |
| `src/pages/app/Signup.tsx` | Add on-blur API validation with loading state |

## UX Flow
1. User types disposable email → instant static warning (no API call)
2. User types email not in static list → on blur, edge function checks with AbstractAPI (~500ms)
3. If AbstractAPI flags it → warning appears, submit disabled
4. If AbstractAPI is down → no warning, static list + DB trigger still protect
5. Small spinner appears next to email field during API check

