## Problem

Onboarding forces every new user to upload a business logo before continuing (`OnboardingWizard.tsx` line 264: `"Please upload a logo before continuing."`), and the upload is failing with `new row violates row-level security policy`.

DB evidence: **not a single business created since 18 June 2026 has a `logo_url` set** (20+ businesses checked). Combined with the mandatory-logo gate, this is a major contributor to the ~100% onboarding drop-off you asked about earlier.

## Root cause analysis

Two independent issues:

1. **Logo is a hard blocker in onboarding** — a logo has zero compliance value and should never block signup. It's UX debt.
2. **Storage RLS on `business-logos` is fragile.** The current INSERT/UPDATE/DELETE policies check `foldername(name)[1] = auth.uid()::text`, and the client writes to `${user.id}/${businessId}/logo.ext`. This works only when the browser's `auth.uid()` at request time exactly equals `user.id` from `AuthContext`. Any session refresh/race during the upsert, or a re-upload attempted by a co-owner/admin (see business_members with role `admin`), fails RLS. Every other bucket in the project (`receipt-scans`, `verification-documents`, `expense-inbox`, `payment-proofs`) uses the safer, business-scoped pattern `is_business_member(auth.uid(), foldername(name)[1]::uuid)`. Logo upload is the outlier.

The error toast also shows the raw Postgres message instead of running through `sanitizeErrorMessage` — cosmetic, but worth fixing while we're in the file.

## Fix plan

### 1. Make the logo optional in onboarding (immediate drop-off relief)

`src/pages/app/OnboardingWizard.tsx`
- Remove the `Please upload a logo before continuing.` validation on step 4.
- Change the field label from `Business logo *` to `Business logo (optional)` and remove the `<span className="text-destructive">*</span>`.
- Keep the upload UI; users can add a logo later from Business Profile.

### 2. Align `business-logos` with the rest of the project (real fix for the RLS error)

Migration:
- Drop the three existing `business-logos` policies (INSERT/UPDATE/DELETE that check `foldername[1] = auth.uid()`).
- Recreate them keyed on business membership, matching `receipt-scans` / `verification-documents`:
  - `bucket_id = 'business-logos' AND auth.uid() IS NOT NULL AND is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)`
- Bucket stays `public = true` (logos are shown on public invoices), so no SELECT policy needed.

New storage path: `${businessId}/logo.${ext}` (business-scoped, no user id in the path). This means:
- Any owner/admin of the business can upload or replace the logo.
- No dependency on the exact `auth.uid()` string matching a folder token.

### 3. Update the upload/delete hook

`src/hooks/use-business.ts`
- `useUploadBusinessLogo`: change `filePath` to `${businessId}/logo.${fileExt}`.
- `useDeleteBusinessLogo`: update the path extraction to the new prefix (`/storage/v1/object/public/business-logos/`) — already generic, just verify.
- Wrap the thrown error through `sanitizeErrorMessage` so users don't see raw Postgres text in the toast.

### 4. Migrate existing objects (best-effort, non-blocking)

The migration will also copy existing `<uid>/<bid>/logo.<ext>` objects to `<bid>/logo.<ext>` and update the corresponding `businesses.logo_url` values with a single SQL block, so historical logos keep rendering. Old objects are left in place (public bucket, no harm) and can be cleaned up later.

## Files touched

- `supabase/migrations/<new>.sql` — drop + recreate the 3 `business-logos` policies, migrate existing object names + `logo_url` values.
- `src/pages/app/OnboardingWizard.tsx` — make logo optional (label + validation).
- `src/hooks/use-business.ts` — new storage path + sanitized error toast.

## Out of scope

- No changes to admin, partner, or mobile-app code.
- No change to `business-logos` bucket public/private setting.
- No change to any other bucket's policies.

## Verification

After applying:
1. Sign up as a fresh user → complete onboarding without uploading a logo (should succeed).
2. From Business Profile, upload a PNG < 500KB → confirm object lands at `<businessId>/logo.png`, `businesses.logo_url` updates, image renders on an invoice.
3. Confirm a second business owner (admin role) can also replace the logo.
