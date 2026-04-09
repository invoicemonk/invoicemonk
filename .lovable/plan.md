

# Real Business Verification System

## Overview

Replace the current label-only `business_identity_level` with an enforceable verification system. Verification is tied to real-world identity (Stripe KYC or admin-reviewed documents), not just user input. Payments and payouts are gated behind verified status.

## Architecture

```text
User enters TIN/CAC → format validated → verification_status = 'self_declared'
                                        verification_source = 'none'

User completes Stripe Connect → webhook fires → verification_status = 'verified'
                                                 verification_source = 'stripe_kyc'

User uploads documents → verification_status = 'pending_review'
                         verification_source = 'manual_review'
                         Admin approves → 'verified' / rejects → 'rejected'

User edits TIN/legal_name/country → verification_status = 'pending_review'
                                     (payments disabled until re-verified)
```

## Implementation

### 1. Database Migration

Add new columns to `businesses`:

- `verification_status TEXT NOT NULL DEFAULT 'unverified'` — enum: `unverified`, `self_declared`, `pending_review`, `verified`, `rejected`
- `verification_source TEXT NOT NULL DEFAULT 'none'` — enum: `none`, `stripe_kyc`, `manual_review`, `government_api`
- `verified_at TIMESTAMPTZ` — when verification was confirmed
- `verified_by UUID` — admin who approved (null for Stripe auto-verify)
- `rejection_reason TEXT` — reason if rejected
- `verification_notes TEXT` — admin notes

Create new table `verification_documents`:
- `id UUID PRIMARY KEY`
- `business_id UUID NOT NULL`
- `uploaded_by UUID NOT NULL`
- `document_type TEXT NOT NULL` (e.g. `cac_certificate`, `tax_clearance`, `utility_bill`)
- `file_url TEXT NOT NULL`
- `file_name TEXT NOT NULL`
- `status TEXT DEFAULT 'pending'` — `pending`, `approved`, `rejected`
- `reviewed_by UUID`
- `reviewed_at TIMESTAMPTZ`
- `review_notes TEXT`
- `created_at TIMESTAMPTZ DEFAULT now()`

RLS: business members can INSERT/SELECT their own docs; platform admins can ALL.

Create a DB trigger `on_sensitive_field_change` on businesses table: when `tax_id`, `legal_name`, or `jurisdiction` changes AND current `verification_status = 'verified'`, automatically set `verification_status = 'pending_review'`.

Create a DB function `admin_set_verification` (SECURITY DEFINER) that:
- Only callable by platform admins (checks `has_role`)
- Sets verification_status + source + verified_at/by
- Logs an audit event
- Prevents setting 'verified' without a valid source

Storage bucket: `verification-documents` (private, RLS-protected).

### 2. Stripe Connect Webhook — Auto-Verify

**File: `supabase/functions/stripe-connect-webhook/index.ts`**

When `account.updated` fires and `charges_enabled && payouts_enabled`:
- Set `verification_status = 'verified'`, `verification_source = 'stripe_kyc'`, `verified_at = now()`
- Log audit event `BUSINESS_VERIFIED` with source `stripe_kyc`

### 3. Business Profile Save — Self-Declared Logic

**File: `src/hooks/use-business.ts` (useUpdateBusiness)**

After save, if `tax_id` or `cac_number` was provided and current status is `unverified`:
- Update `verification_status = 'self_declared'`, `verification_source = 'none'`

If sensitive fields (tax_id, legal_name, jurisdiction) changed and status was `verified`:
- The DB trigger handles the downgrade to `pending_review`
- Frontend shows a warning toast: "Your verification status has been reset because you changed sensitive fields."

### 4. Document Upload Section

**File: `src/pages/app/BusinessProfile.tsx`** — new "Verification" tab

Add a new tab showing:
- Current verification status with clear explanation
- Upload area for CAC certificate, tax documents
- List of previously uploaded documents with status badges
- "Submit for Review" button that sets `verification_status = 'pending_review'`

**New hook: `src/hooks/use-verification-documents.ts`**
- `useVerificationDocuments(businessId)` — fetch documents
- `useUploadVerificationDocument()` — upload to storage + insert record
- `useSubmitForReview()` — set business to pending_review

### 5. Admin Review UI

**File: `src/components/admin/BusinessDetailSheet.tsx`**

Add a "Verification" section:
- Show current verification_status, source, verified_at
- List uploaded documents with download links
- Approve / Reject buttons with mandatory reason field
- All actions go through `admin_set_verification` RPC (audit-logged)

**File: `src/pages/admin/AdminBusinesses.tsx`**

Add verification status column and filter to the businesses table.

### 6. Payment & Payout Gating

**File: `src/components/settings/OnlinePaymentsSettingsCard.tsx`**

If `verification_status !== 'verified'`:
- Disable Stripe Connect and Paystack setup buttons
- Show banner: "Complete business verification to receive payments"

**File: `src/pages/public/InvoiceView.tsx`** and `src/pages/verify/VerifyInvoice.tsx`

If business is not verified:
- Hide or disable "Pay Now" button
- Show notice: "This business has not completed identity verification"

**File: `supabase/functions/create-connect-account/index.ts`**

Add server-side check: if `verification_status` is `unverified` or `rejected`, return 403 with message "Business verification required before connecting payment accounts."

### 7. IdentityLevelBadge Update

**File: `src/components/app/IdentityLevelBadge.tsx`**

Replace the old `business_identity_level` mapping with the new `verification_status` + `verification_source`. Show source info in tooltip:
- "Verified via Stripe KYC" / "Verified by Invoicemonk" / "Pending admin review" / "Rejected — reason"

### 8. Invoice Trust Badge

**Files: `src/pages/public/InvoiceView.tsx`, `src/pages/verify/VerifyInvoice.tsx`**

The existing verification page already shows issuer identity. Enhance it:
- If `verified` + `stripe_kyc`: show green "Verified via Stripe"
- If `verified` + `manual_review`: show green "Verified by Invoicemonk"
- If `self_declared`: show amber "Self-Declared — Not independently verified"
- If `unverified`: show red "Unverified Business"

### 9. Edge Function: verify-invoice Enhancement

**File: `supabase/functions/verify-invoice/index.ts`**

Include `verification_status` and `verification_source` in the verification response so the public verification page can display trust badges.

## Security Guarantees

- `verified` status can ONLY be set by: (a) Stripe webhook with active Connect, or (b) `admin_set_verification` RPC with platform_admin role check
- No client-side code can directly set `verification_status = 'verified'`
- All verification state changes are audit-logged
- Sensitive field edits automatically downgrade verification (DB trigger, not client-side)

## Files Changed

| File | Change |
|---|---|
| New migration | Add verification columns, `verification_documents` table, triggers, RPC, storage bucket |
| `supabase/functions/stripe-connect-webhook/index.ts` | Auto-set verified on Connect completion |
| `supabase/functions/create-connect-account/index.ts` | Block unverified businesses from connecting |
| `supabase/functions/verify-invoice/index.ts` | Include verification status in response |
| `src/components/app/IdentityLevelBadge.tsx` | Map new verification_status + source |
| `src/pages/app/BusinessProfile.tsx` | Add Verification tab with document upload |
| `src/hooks/use-verification-documents.ts` | New hook for document CRUD |
| `src/hooks/use-business.ts` | Self-declared logic on save |
| `src/components/settings/OnlinePaymentsSettingsCard.tsx` | Gate payment setup behind verification |
| `src/pages/public/InvoiceView.tsx` | Gate Pay Now, show trust badge |
| `src/pages/verify/VerifyInvoice.tsx` | Show trust badge |
| `src/components/admin/BusinessDetailSheet.tsx` | Admin verification review UI |
| `src/pages/admin/AdminBusinesses.tsx` | Add verification status column |

