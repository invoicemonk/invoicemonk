

# Configurable Invoice Number Digits (with Jurisdiction-Aware Defaults)

## Clarification

The previously approved plan only adds a **manual setting** — users would need to know they need to change it. It would NOT automatically handle Bulgaria or other jurisdictions.

This revised plan adds **both layers**: a manual override AND automatic jurisdiction-aware defaults, so Bulgarian businesses (and others) get the right digit count without needing to configure anything.

## How It Works

1. **Jurisdiction config** defines the default digit count per country (e.g., Bulgaria = 10)
2. When a business selects their country (during onboarding or in Business Profile), the default is applied automatically
3. Users can still override it manually in Invoice Settings if needed

## Changes

### 1. Database Migration
- Add `invoice_number_digits` column (INTEGER, DEFAULT 4, CHECK 1-15) to `businesses` table
- Update `generate_invoice_number()` SQL function to read `invoice_number_digits` from the business and use it for `LPAD` padding

### 2. Jurisdiction Config (`src/lib/jurisdiction-config.ts`)
- Add `invoiceNumberDigits?: number` to `JurisdictionConfig` interface
- Set `invoiceNumberDigits: 10` for Bulgaria (BG) and other countries that require it (e.g., Romania, Poland — countries with known 10-digit requirements)
- Default remains 4 for unconfigured jurisdictions

### 3. Country Confirmation Page (`src/pages/app/CountryConfirmation.tsx`)
- When user selects their country and clicks Continue, also save `invoice_number_digits` from the jurisdiction config to the business record

### 4. Business Profile UI (`src/pages/app/BusinessProfile.tsx`)
- Add "Invoice Number Digits" input (number input, min 1 max 15) in the Invoice Settings section next to the prefix field
- Show a live preview: e.g., "INV-0000000001" updating as they change the digit count
- Pre-populate from the business record (which was auto-set from jurisdiction)

### 5. Type Updates (`src/integrations/supabase/types.ts`)
- Add `invoice_number_digits` to businesses Row/Insert/Update types

### 6. Client-Side Fallback (`src/hooks/use-invoices.ts`)
- Update legacy non-business invoice number generation to use 4 digits (no change needed, just ensuring consistency)

## Files Changed

| File | Change |
|---|---|
| New migration | Add `invoice_number_digits` column + update `generate_invoice_number()` |
| `src/lib/jurisdiction-config.ts` | Add `invoiceNumberDigits` to interface + set for BG and similar countries |
| `src/integrations/supabase/types.ts` | Add field to businesses types |
| `src/pages/app/CountryConfirmation.tsx` | Auto-save jurisdiction's digit default on country selection |
| `src/pages/app/BusinessProfile.tsx` | Add digit count config UI in Invoice Settings |
| `src/hooks/use-invoices.ts` | Minor — ensure legacy path uses padStart consistently |

