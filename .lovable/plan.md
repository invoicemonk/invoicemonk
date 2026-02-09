
# Fix: Client Details and Payment Instructions Missing from Invoice

## Problem Summary

Three issues are affecting invoices sent to customers:

| Issue | What's Happening | Where |
|-------|-----------------|-------|
| Client details show as "Client" | Recipient snapshot uses wrong field names | PDF + Online View |
| No client email/phone/address | Same root cause as above | PDF + Online View |
| Payment instructions missing | Not returned by API and not rendered | Online View only |

## Root Cause

### Bug 1: Mismatched Snapshot Keys (Client Details)

The `issue_invoice` database function stores the recipient snapshot with **prefixed** keys:

```
client_name, client_email, client_phone, client_address, contact_person
```

But every consumer expects **unprefixed** keys:

```
name, email, phone, address
```

So when the PDF generator does `recipientSnapshot?.name`, it gets `undefined` because the actual key is `client_name`. The fallback shows "Client" instead of the real name.

### Bug 2: Payment Instructions Not Shown Online

The `view-invoice` edge function does not include `payment_method_snapshot` in its response, and the `InvoiceView.tsx` page has no UI for rendering payment instructions.

The PDF does render payment instructions correctly (it reads directly from the invoice record), so this only affects the online view.

## Fix Plan

### 1. Fix `issue_invoice` Database Function

Update the recipient snapshot to use unprefixed keys that match what consumers expect:

```sql
recipient_snapshot = jsonb_build_object(
  'name', _client.name,            -- was 'client_name'
  'email', _client.email,           -- was 'client_email'
  'phone', _client.phone,           -- was 'client_phone'
  'address', _client.address,       -- was 'client_address'
  'contact_person', _client.contact_person,
  'tax_id', _client.tax_id,
  'cac_number', _client.cac_number
)
```

This is a **database migration** that replaces the function.

### 2. Add Payment Method Snapshot to `view-invoice` Edge Function

Update `supabase/functions/view-invoice/index.ts`:
- Add `payment_method_snapshot` to the invoice select query
- Include it in the response object
- Update the TypeScript interfaces

### 3. Add Payment Instructions UI to `InvoiceView.tsx`

Update `src/pages/public/InvoiceView.tsx`:
- Add `payment_method_snapshot` to the response interface
- Add a "Payment Instructions" card after the totals section
- Style it consistently with the rest of the invoice view (green-tinted card)

### 4. Re-issue Existing Invoice

Since INV-0002 was already issued with the wrong keys, the snapshot is frozen. After the fix:
- **New invoices** will have correct snapshots automatically
- **Existing invoices** (like INV-0002) will need to be voided and re-issued, OR a one-time data migration can fix them

A migration query to fix existing snapshots:

```sql
UPDATE invoices
SET recipient_snapshot = jsonb_build_object(
  'name', recipient_snapshot->>'client_name',
  'email', recipient_snapshot->>'client_email',
  'phone', recipient_snapshot->>'client_phone',
  'address', recipient_snapshot->'client_address',
  'contact_person', recipient_snapshot->>'contact_person',
  'tax_id', recipient_snapshot->>'tax_id',
  'cac_number', recipient_snapshot->>'cac_number'
)
WHERE recipient_snapshot->>'client_name' IS NOT NULL
  AND recipient_snapshot->>'name' IS NULL;
```

Also invalidate any cached PDFs so they regenerate with correct data:

```sql
-- The PDF cache in storage will need clearing for affected invoices
```

## Files Changed

| File | Change |
|------|--------|
| Database migration | Fix `issue_invoice` recipient snapshot keys + backfill existing data |
| `supabase/functions/view-invoice/index.ts` | Add `payment_method_snapshot` to query and response |
| `src/pages/public/InvoiceView.tsx` | Add payment instructions card, update interface |

## After the Fix

- **Bill To** section will show client name, email, phone, and address
- **Payment Instructions** card will appear on the online invoice view when a payment method is set
- **PDF** will also show correct client details (after cache is cleared)
- Existing invoices are fixed by the backfill migration
