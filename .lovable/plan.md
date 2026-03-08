

# Remove PDFShift — Use pdfmake for Receipt PDF Generation

## Problem

The `generate-receipt-pdf` edge function uses PDFShift (a paid, metered external API) to convert HTML to PDF. This is unnecessary since **pdfmake** — a free, open-source library — is already used successfully in `send-invoice-email` for the same purpose.

## Current State

- **PDFShift used in**: `supabase/functions/generate-receipt-pdf/index.ts` only
- **pdfmake used in**: `supabase/functions/send-invoice-email/index.ts` (proven to work in Deno)
- **Frontend expects**: base64-encoded PDF data in the response (decodes and downloads as `.pdf`)

## Plan

### File: `supabase/functions/generate-receipt-pdf/index.ts`

1. **Remove all PDFShift references** — delete the `PDFSHIFT_API_KEY` env read, the fetch to `api.pdfshift.io`, and the fallback HTML path.

2. **Add a `generateReceiptPdfBase64` function using pdfmake** (same pattern as `send-invoice-email`):
   - Import pdfmake dynamically from esm.sh (same imports already working in `send-invoice-email`)
   - Build a structured document definition from the receipt data (issuer, payer, amount, payment details, invoice reference, verification info)
   - Generate PDF as base64 string
   - Include watermark text for starter tier if applicable

3. **Replace the PDFShift call** (~lines 419-457) with a single call to the new `generateReceiptPdfBase64` function.

4. **Response format stays identical** — `{ success: true, pdf: "<base64>", filename: "RCP-XXX.pdf" }` — so **no frontend changes needed**.

### Result
- Zero external API dependency for PDF generation
- Unlimited PDFs at no cost
- Consistent approach across the codebase (pdfmake everywhere)

