

# Brand Colors & Distinct Template Layouts

## Overview

Two connected features: (1) let users set a brand color on their business with per-invoice override, and (2) make the 4 templates visually distinct with completely different HTML layouts in both the preview card and PDF generator.

## Part 1: Brand Color

### Database
- Add `brand_color TEXT` column to `businesses` table (nullable, default null)
- No RLS changes needed (existing policies cover updates)

### Business Profile (`BusinessProfile.tsx`)
- Add a color picker input in the branding section (near logo upload)
- Simple `<input type="color">` with a hex text input beside it
- Saves to `brand_color` on the business record

### Invoice Form (`InvoiceNew.tsx` + `InvoiceEdit.tsx`)
- Add an optional "Brand Color" override field below template selection
- Pre-fills from `currentBusiness.brand_color`
- User can change it per-invoice
- The chosen color feeds into `templateConfig.styles.primary_color` for preview
- On save/issue, stored in `template_snapshot.styles.primary_color`

## Part 2: Fully Distinct Template Layouts

Each template will have a completely different arrangement — not just color/border tweaks.

```text
┌─────────────────────────────────────────────────┐
│ BASIC (Minimal)                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ INVOICE #INV-001          Issue: Jan 1 2026 │ │
│ │                            Due: Feb 1 2026  │ │
│ ├─────────────────────────────────────────────┤ │
│ │ From: Business Name    To: Client Name      │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Items table (compact, no background)        │ │
│ ├─────────────────────────────────────────────┤ │
│ │                          Subtotal: $500     │ │
│ │                          Total:    $540     │ │
│ └─────────────────────────────────────────────┘ │
│ No logo, no QR, no terms. Gray accents only.    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PROFESSIONAL (Standard) — current layout        │
│ ┌─────────────────────────────────────────────┐ │
│ │ [Logo] Business Name        INVOICE         │ │
│ │ Address / TIN              #INV-001         │ │
│ │                            Date / Due       │ │
│ ├─────────────────────────────────────────────┤ │
│ │ From: ...             Bill To: ...          │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Items table with brand-colored headers      │ │
│ ├─────────────────────────────────────────────┤ │
│ │                    Totals (right-aligned)   │ │
│ │ Notes / Terms              QR verification  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ MODERN                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │▓▓▓▓▓▓▓▓ FULL-WIDTH BRAND COLOR BAR ▓▓▓▓▓▓▓▓│ │
│ │▓▓ [Logo centered]   INVOICE #INV-001     ▓▓▓│ │
│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │
│ │                                             │ │
│ │ ┌──────────────┐   ┌──────────────────────┐ │ │
│ │ │ FROM (card)  │   │ TO (card)            │ │ │
│ │ └──────────────┘   └──────────────────────┘ │ │
│ │                                             │ │
│ │ Items (rounded rows, alternating bg)        │ │
│ │                                             │ │
│ │ ┌──────────── Totals card ────────────────┐ │ │
│ │ │ Subtotal / Tax / Grand Total            │ │ │
│ │ └────────────────────────────────────────┘  │ │
│ │                                             │ │
│ │ Notes in card    │    QR + Verification     │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ENTERPRISE                                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ ═══════════════════════════════════════════ │ │
│ │          [Logo centered]                    │ │
│ │          BUSINESS LEGAL NAME                │ │
│ │          TIN / VAT / Registration           │ │
│ │ ═══════════════════════════════════════════ │ │
│ │                                             │ │
│ │ INVOICE NO: INV-001   DATE: Jan 1, 2026    │ │
│ │ STATUS: ISSUED         DUE: Feb 1, 2026    │ │
│ │ ─────────────────────────────────────────── │ │
│ │                                             │ │
│ │ ISSUER              │  RECIPIENT            │ │
│ │ Full details...     │  Full details...      │ │
│ │ ─────────────────────────────────────────── │ │
│ │                                             │ │
│ │ Items (formal table with borders)           │ │
│ │ ─────────────────────────────────────────── │ │
│ │                                             │ │
│ │ Totals (boxed, right)  │  Bank Details      │ │
│ │                        │  (if available)    │ │
│ │ ─────────────────────────────────────────── │ │
│ │ Terms │ Notes │ QR + Hash + Verification    │ │
│ │ ═══════════════════════════════════════════ │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Files to Change

### Database Migration
- Add `brand_color` to `businesses`

### Frontend (5 files)
1. **`BusinessProfile.tsx`** — Add color picker field, save `brand_color`
2. **`InvoiceNew.tsx`** — Add brand color override, pass to preview
3. **`InvoiceEdit.tsx`** — Same as above
4. **`InvoicePreviewCard.tsx`** — Rewrite to render 4 distinct layout structures based on `header_style` (minimal/standard/modern/enterprise), each with different DOM arrangement, logo position, section styling
5. **`InvoicePreviewDialog.tsx`** — No structural changes, just passes props through

### Edge Function (1 file)
6. **`generate-pdf/index.ts`** — Rewrite HTML generation to produce 4 distinct PDF layouts matching the preview designs. Each `header_style` gets its own HTML template block with unique CSS and structure.

## Technical Notes

- Brand color flows: `business.brand_color` → invoice form default → `template_snapshot.styles.primary_color` on issue → PDF uses snapshotted color
- The `TemplateConfig` interface already supports `styles.primary_color`, so no type changes needed
- Each template layout in the preview will be a conditional render block (not just CSS class swaps — different DOM structure)
- PDF HTML will use a switch on `tplHeaderStyle` to output completely different `<body>` content per template

