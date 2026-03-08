

# Block Disposable/Temporary Email Signups

## Problem
Users are registering with temporary/disposable email services (e.g., guerrillamail, tempmail, mailinator), which undermines platform trust, enables abuse, and reduces engagement quality.

## Approach
Implement a **dual-layer block** -- client-side validation for instant feedback, plus server-side validation in the Supabase auth trigger to prevent bypassing.

### Layer 1: Client-Side Disposable Email Check

**File: `src/lib/disposable-emails.ts`** (new)

Create a comprehensive blocklist of ~200+ known disposable email domains (mailinator.com, guerrillamail.com, tempmail.com, yopmail.com, throwaway.email, etc.) and a helper function `isDisposableEmail(email: string): boolean` that extracts the domain and checks against the list.

**File: `src/pages/app/Signup.tsx`**

Add a `.refine()` to the `email` field in the Zod schema that calls `isDisposableEmail()` and rejects with a clear message: "Please use a permanent email address. Temporary/disposable emails are not allowed."

### Layer 2: Server-Side Validation (Database Trigger)

**Migration SQL:**

Create a `validate_email_domain()` function as a trigger on `auth.users` -- **wait, we cannot attach triggers to `auth` schema tables** per Supabase restrictions.

**Alternative server-side approach:** Create an edge function `validate-signup-email` that the signup form calls before `signUp()`, or use a database function called post-signup to flag/disable accounts with disposable emails.

Actually, the most practical and effective approach for Supabase:

1. **Client-side blocklist** (primary defense -- covers 95% of cases)
2. **Post-signup database check** via a trigger on `profiles` table (which IS in public schema and gets created on signup) that flags accounts using disposable emails

### Layer 2 (revised): Profile Insert Trigger

**Migration:**
- Create a `disposable_email_domains` table with a `domain` column containing all blocked domains
- Create a `check_disposable_email()` trigger function on `profiles` INSERT that checks if the email domain is in the blocklist -- if so, set `account_status = 'suspended'` and log the reason
- This catches any bypass of the frontend check

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/lib/disposable-emails.ts` | New file with blocklist of ~200+ disposable domains and checker function |
| `src/pages/app/Signup.tsx` | Add `.refine()` on email field to reject disposable emails with clear error message |
| **Database migration** | Create `disposable_email_domains` table + trigger on `profiles` to auto-suspend accounts using disposable emails |
| `supabase/functions/view-invoice/index.ts` | Add `business_id` to select query (existing build error fix) |

### Disposable Domain Categories to Block

The blocklist will include domains from these categories:
- **Temporary inbox services**: mailinator.com, guerrillamail.com, tempmail.com, throwaway.email
- **Anonymous email**: yopmail.com, sharklasers.com, grr.la, dispostable.com
- **10-minute mail variants**: 10minutemail.com, minutemail.com, temp-mail.org
- **Popular abuse domains**: maildrop.cc, trashmail.com, fakeinbox.com, mohmal.com
- Total: ~250 domains covering the vast majority of disposable services

### User Experience

When a user enters a disposable email:
- The form shows an inline error: "Please use a permanent email address. Temporary or disposable emails are not allowed."
- The submit button remains disabled
- If somehow bypassed, the profile trigger suspends the account immediately

