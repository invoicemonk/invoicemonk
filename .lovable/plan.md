

# Fix: Template Snapshot Missing + Cached Old PDFs + Email PDFs

## Root Causes

Three issues are preventing templates from working end-to-end:

### 1. `issue_invoice` DB function never saves `template_snapshot`
The latest version of the `issue_invoice` function (migration `20260222...`) snapshots issuer, recipient, tax schema, and payment method — but **skips template_snapshot entirely**. Every issued invoice has `template_snapshot = NULL`, so the PDF generator falls back to the "standard" layout.

### 2. PDF cache serves stale HTML
The `generate-pdf` edge function caches generated HTML in Supabase Storage (`invoice-pdfs` bucket). Once cached, subsequent downloads return the old HTML without ever reaching the new template branching logic (lines 248-265). All previously-generated invoices are stuck with the old layout.

### 3. `send-invoice-email` uses hardcoded layout
The email function has its own `generateProfessionalHtml()` and `generateInvoicePdfBase64()` functions that produce a single layout regardless of template.

## Fix Plan

### Migration: Fix `issue_invoice` to snapshot template
- Declare `_template invoice_templates%ROWTYPE`
- Look up the template by `_invoice.template_id`
- Add `template_snapshot = jsonb_build_object('name', layout, styles, watermark_required, supports_branding)` to the UPDATE statement
- For invoices without a template_id, preserve existing value

### Edge Function: `generate-pdf` — invalidate stale cache
- After fetching the invoice, compare `template_snapshot` hash against cached version
- Simplest fix: skip cache when `template_snapshot` is present (the cache was designed for the old single-layout era)
- Or: include template header_style in cache key path so each template gets its own cache entry

### Edge Function: `send-invoice-email` — template-aware HTML + PDF
- Read `template_snapshot` from the fetched invoice
- Update `generateProfessionalHtml()` to branch on `header_style` (minimal/standard/modern/enterprise), applying primary_color and layout flags
- Update `generateInvoicePdfBase64()` (pdfmake) to produce different document definitions per template style

### Files to change
1. **New DB migration** — fix `issue_invoice` to include template snapshot
2. **`supabase/functions/generate-pdf/index.ts`** — bust stale cache (include header_style in cache path)
3. **`supabase/functions/send-invoice-email/index.ts`** — make both HTML and PDF generators template-aware

### Backward compatibility
- Invoices with `template_snapshot = NULL` fall back to "standard" layout (current behavior preserved)
- New invoices issued after the migration will have proper snapshots
- Stale cached PDFs will be bypassed via updated cache key

