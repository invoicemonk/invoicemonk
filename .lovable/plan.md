

# Implement Visual Differentiation for Invoice Templates

## Problem
The 4 invoice templates (Basic, Professional, Modern, Enterprise) each have distinct `layout` and `styles` configurations stored in the database, but both the preview card (`InvoicePreviewCard.tsx`) and the PDF generator (`generate-pdf/index.ts`) use a single hardcoded HTML layout. The template data is saved on the invoice but never actually applied to rendering.

## Current Template Differences (from DB)

```text
Template     | header_style | primary_color | show_logo | show_terms | show_qr | show_bank_details
-------------|-------------|---------------|-----------|------------|---------|------------------
Basic        | minimal     | #6B7280       | false     | false      | false   | -
Professional | standard    | #1F2937       | true      | true       | true    | -
Modern       | modern      | #4F46E5       | true      | true       | true    | -
Enterprise   | enterprise  | #111827       | true      | true       | true    | true
```

## Solution

### 1. Update `InvoicePreviewCard.tsx`
- Accept optional `templateSnapshot` prop (layout + styles from the selected template)
- Apply template-driven conditional rendering:
  - **show_logo**: Show/hide business logo
  - **show_terms**: Show/hide terms section
  - **show_verification_qr**: Show/hide QR code
  - **primary_color**: Apply to header border, section labels, and accents
  - **header_style**: Visual variations (minimal = compact no-border, standard = current, modern = indigo accent with larger typography, enterprise = double-border formal style)

### 2. Update `InvoiceNew.tsx` and `InvoiceEdit.tsx`
- When a template is selected, pass the template's layout/styles to the preview card
- Build `template_snapshot` into the preview invoice object so the preview reflects the selected template

### 3. Update `generate-pdf/index.ts` (Edge Function)
- Read `template_snapshot` from the invoice (already fetched but ignored)
- Apply layout flags: conditionally render logo, terms, QR code, bank details sections
- Apply styles: use `primary_color` for header border, status badge, section labels
- Apply `header_style` variations:
  - **minimal**: No border, smaller header, gray tones
  - **standard**: Current layout (no change needed)
  - **modern**: Indigo/purple accent color, slightly larger fonts, rounded elements
  - **enterprise**: Formal double-border header, structured sections with clear separators

### Files to modify
- `src/components/invoices/InvoicePreviewCard.tsx` — template-aware rendering
- `src/pages/app/InvoiceNew.tsx` — pass template data to preview
- `src/pages/app/InvoiceEdit.tsx` — pass template data to preview
- `supabase/functions/generate-pdf/index.ts` — template-aware PDF HTML generation

