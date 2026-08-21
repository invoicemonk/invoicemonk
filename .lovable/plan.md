# Remove the pre-filled "Sample Service" invoice line

## What is actually happening (verified)

The new-invoice form prefills a fake line item for anyone who has not created an invoice yet:
`src/pages/app/InvoiceNew.tsx:205-219` sets a single item with description **"Sample Service"** and a
currency-based amount from `getSmartPrefillAmount()` (100, or 10,000 for low-value/zero-decimal currencies).

Because that placeholder has both a description and a price > 0, it passes `validateForm()` in both
`InvoiceNew.tsx` and `InvoiceEdit.tsx` — so users can save it, issue it (immutable), and mark it paid
without ever typing a real line item.

Database check confirms the impact: 16 invoices carry a "Sample Service" line across 13 businesses;
15 of them are already issued (no longer editable) and 1 is marked paid. No invoice in the system has
zero line items, so the problem is purely this placeholder, not a missing-items path.

## Fix

1. **Delete the prefill.** Remove the `isFirstInvoice` prefill effect, the `prefillApplied` state, and
   `getSmartPrefillAmount()` from `InvoiceNew.tsx`. New invoices start with one empty line
   (description empty, quantity 1, price 0) as they do for every other user.

2. **Guarantee a real line item.** Tighten `validateForm()` in `InvoiceNew.tsx` and `InvoiceEdit.tsx`:
   - every submitted line must have a non-empty description **and** quantity > 0 **and** price > 0;
   - invoice total must be > 0;
   - reject descriptions that are only the placeholder text (`sample service`, `sample`, `test`,
     `placeholder`, `n/a`, or a bare `-`) so a stray leftover cannot be issued.
   Show a clear toast naming the offending line instead of the current generic message.

3. **Guide instead of prefill.** For a first-time user, keep the existing jurisdiction alert and add a
   short empty-state hint above the line-item table ("Add what you're billing for — description,
   quantity and unit price") plus disabled Save/Issue buttons until at least one valid line exists.
   No fake data, no fake amounts.

4. **Optional cleanup of existing records.** Issued invoices are immutable by design, so they cannot be
   edited. The 15 issued placeholder invoices can either be left as historical records, or voided via
   the normal credit-note flow. Tell me which you prefer — I will not touch financial records without
   your say-so. The 1 draft-side artifact can simply be deleted.

## Technical scope

Files: `src/pages/app/InvoiceNew.tsx`, `src/pages/app/InvoiceEdit.tsx`, and a small shared validation
helper for the line-item rules (placed alongside the other validators in `src/lib/`). Frontend only —
no schema, RLS, or billing changes. Server-side immutability and `issue_invoice` stay untouched.
