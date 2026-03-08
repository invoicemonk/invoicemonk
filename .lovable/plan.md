

# Enhance Setup Checklist & Profile Banner with Compliance Context

## Problem
The current checklist items are generic ("Add your first customer", "Tell clients how to pay you"). They don't explain **why** each step matters for compliance, what specific information the user needs to provide about their own business, or what they need to collect from their customers before they can issue a valid invoice.

## Changes

### 1. `src/hooks/use-quick-setup.ts` — Richer checklist item data
Add a `complianceTip` field to each `ChecklistItem` explaining the compliance reason and what info is needed:

| Step | Current description | New description + compliance tip |
|------|-------------------|--------------------------------|
| Country | "Set your jurisdiction for compliant invoicing" | **desc**: "Required on every invoice by law in most jurisdictions" · **tip**: "Your country determines tax rules, invoice numbering, and required fields" |
| Payment method | "Tell clients how to pay you" | **desc**: "Bank details or payment instructions must appear on invoices" · **tip**: "You'll need: bank name, account number/IBAN, and routing/sort code" |
| Client | "Add your first customer" | **desc**: "Recipient details are legally required on invoices" · **tip**: "Collect from your customer: legal name, address, and tax ID (if B2B)" |
| Product | "Define what you sell" | **desc**: "Line items need clear descriptions and unit prices" · **tip**: "Include: item name, quantity, unit price, and applicable tax rate" |
| Invoice | "Create and issue a compliant invoice" | **desc**: "Issue a tamper-evident invoice with a unique number and QR code" · **tip**: "Each invoice gets a verification ID, SHA-256 hash, and public verification page" |

### 2. `src/components/dashboard/QuickSetupChecklist.tsx` — Show compliance tips
- Display the `complianceTip` below each incomplete item's description in a subtle style (e.g., small text with a Shield icon)
- Add a header subtitle: "Each step ensures your invoices meet legal requirements"
- Update celebration copy to mention compliance artifacts (hash, QR, verification)

### 3. `src/components/app/CompleteProfileBanner.tsx` — Add compliance context
- Replace the generic "Add your country, currency, email..." message with field-specific compliance reasons
- Show a brief explanation per missing field (e.g., "**Tax ID** — required on invoices in most jurisdictions" rather than just listing "tax ID")
- Add a small "What you'll need" hint: "Have your tax registration number and business address ready"

### 4. `src/hooks/use-quick-setup.ts` — Add business profile completeness items
Add two new checklist items between "country" and "payment method":
- **Business address** — "Your address must appear on every invoice" · complete when `address?.city && address?.country`
- **Tax ID** — "Required for tax-compliant invoicing" · complete when `tax_id` is set

Update the `ChecklistItem` interface to include the new `complianceTip: string` field.

### Files to edit
| File | Change |
|------|--------|
| `src/hooks/use-quick-setup.ts` | Add `complianceTip` field, add address/tax items, update descriptions |
| `src/components/dashboard/QuickSetupChecklist.tsx` | Render compliance tips, update header/celebration copy |
| `src/components/app/CompleteProfileBanner.tsx` | Per-field compliance reasons instead of comma-separated list |

