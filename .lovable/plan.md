

# Fix: Receipt PDF Download Crash — Courier Font Not Available

## Problem
The `generate-receipt-pdf` edge function crashes with: `Font 'Courier' in style 'bold' is not defined in the font section of the document definition.`

pdfmake's default VFS only includes Roboto. The code references `font: 'Courier'` in two places, causing the crash.

## Fix in `supabase/functions/generate-receipt-pdf/index.ts`

Two lines need `font: 'Courier'` removed:

1. **Line 110** (payment method instructions): Change `{ text: String(v), bold: true, font: 'Courier' }` to `{ text: String(v), bold: true }`
2. **Line 244** (SHA-256 hash): Change `{ text: ..., fontSize: 9, font: 'Courier', color: '#6b7280' }` to `{ text: ..., fontSize: 9, color: '#6b7280' }`

Also apply the same fixes from the invoice email function:
- Format payment method keys (replace underscores with spaces, title case)
- Use currency symbols instead of full currency codes

No frontend changes needed. Redeploy the edge function.

