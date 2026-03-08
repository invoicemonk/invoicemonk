

# Fix Template PDF Issues

After reviewing all four downloaded PDFs, here are the issues identified:

## Issues Found

### 1. Professional (Standard) — Duplicate Totals
The template renders **both** an "Invoice Summary" box (Total Items, Subtotal, Grand Total, Amount Due) **and** the shared `totalsHtml` block (Subtotal, Total) directly below it. This creates redundant financial information on the page.

**Fix**: Remove the standalone `${totalsHtml}` call from the standard template since the Invoice Summary box already contains all the same data in a more detailed format.

### 2. Modern — Header Bar Clipped
The full-width brand color bar uses `margin: -12mm -15mm` to bleed to the page edges, but this causes the header content to be cut off at the sides when printed. The invoice number and status badge are partially hidden.

**Fix**: Replace the negative margin approach with a contained full-width bar that respects print margins, or adjust the negative margins to account for the container properly.

### 3. Enterprise — Business Name Has Broken Spacing
The letterhead shows "OLAY INKA OLAYOKUN" instead of "OLAYINKA OLAYOKUN". The `letter-spacing: 1px` combined with `text-transform: uppercase` creates visual gaps that break at word boundaries inconsistently.

**Fix**: Remove or reduce the `letter-spacing` on the business name to prevent character spacing artifacts.

## Files to Change

- **`supabase/functions/generate-pdf/index.ts`** — Fix all three issues in the template-specific body HTML sections

## Changes Detail

### Standard template (line ~793)
Remove the duplicate `${totalsHtml}` line since the Invoice Summary box above it already has all totals.

### Modern template (line ~643)
Change the header `margin` from `-12mm -15mm` to use padding-based approach within the container, ensuring the brand color bar renders fully without clipping.

### Enterprise template (line ~694)
Remove `letter-spacing: 1px` from the business name `<div>` to prevent spacing artifacts.

