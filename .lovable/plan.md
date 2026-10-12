# Fix the "Access Denied" screen and let Dormant Research emails deliver

## 1. Why users (and you) see "Access Denied"

What we found:
- All 184 accounts have a business they belong to, and the access rules for businesses look correct. So this is not a real permission problem.
- The message in your screenshot is the generic fallback. It shows whenever the app's lookup of "which businesses does this person belong to" comes back empty or fails, for example while sign-in is still being restored on a slow phone connection, or when the lookup briefly errors. Your logs from this morning also show a slow "app startup timed out" on the same session.
- Today the app treats "couldn't load yet" and "you have no access" the same way, never retries, and keeps that empty answer for 5 minutes. That is why it sticks until people refresh or log in again.

What we'll change:
- Wait until sign-in is fully restored before looking up the user's businesses.
- Retry the lookup automatically if it fails, instead of treating a failure as "no access".
- Show "Access Denied" only when we positively confirm the person isn't a member of that business. If the lookup failed, show "We couldn't load your business" with a **Try again** button.
- Remove the brief moment where the page shows "Access Denied" before the business finishes opening.
- First step: reproduce it on a phone-sized screen to confirm this is the cause before changing anything.

## 2. Dormant Research emails: no more test mode

Nobody turned test mode on by hand. It was a built-in safety default for all automatic emails, and the admin send button was wired to the same rule, so it held your email. There was also no screen for managing an approved list. That's being removed for this button.

What we'll change:
- **Send email** in Dormant Research will deliver to the real recipient. No test mode, no approved list, and no "[TEST]" added to the subject.
- These sensible protections stay in place:
  - people who unsubscribed are never emailed
  - each person gets emails in order (Email 1, then 2, then 3) with the waiting gaps between them
  - nobody gets the same email twice
  - nobody gets more than 5 emails from us in 30 days
- The confirmation and result messages will just say "Sent", or give the plain reason someone was skipped (for example "already received Email 1").
- Automatic emails, like onboarding tips, will stay as they are now. Nothing goes out to customers on its own unless you ask for that separately.

## Technical details

- `src/contexts/BusinessContext.tsx`: gate the `user-businesses` query on the auth session being ready; add `retry: 2`; expose a `loadError` separate from `error`; resolve the URL membership synchronously with `useMemo` so there's no gap render with `loading=false` and no business; don't cache an empty result while signed in (refetch once before concluding).
- `src/components/app/BusinessLayout.tsx`: show a separate load-failure state with a Try again button (`refreshBusiness`); show "Access Denied" only for a confirmed non-membership.
- `supabase/functions/send-dormant-research/index.ts`: stop reading `test_mode`, `test_recipients` and `LIFECYCLE_EMAIL_TEST_MODE` for manual sends; drop the `[TEST]` subject prefix; keep the opt-out, sequence, duplicate/cooldown and 5-per-30-day cap checks; log `test_mode:false` in delivery metadata.
- `supabase/functions/_shared/research-send-policy.ts` and `policy.test.ts`: remove the test-mode branch and update the tests.
- `src/components/admin/discovery/DormantResearch.tsx`: remove the test-mode/allowlist wording from the helper text, confirmation and toast.
- Leave `lifecycle_campaign_config` unchanged so automatic campaigns keep their current settings.
- `AGENTS.md`: replace the lifecycle safety rule with one that says admin-initiated Dormant Research sends deliver directly (opt-out, sequence, dedupe and cap still apply), while automatic campaigns follow the test-mode settings.
- Verify: run the function tests, deploy, send one Email 1 to the admin's own listed account and confirm it shows as sent in the delivery log; reproduce the business page on a mobile viewport.
