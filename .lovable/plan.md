
# Smart Receipt Scanner with AI-Powered Data Extraction

## Overview

Add a "Scan Receipt" feature that lets users photograph or upload physical receipts. An AI vision model (Gemini via Lovable AI Gateway) extracts vendor, date, amount, currency, tax, and line items. The system auto-categorizes the expense and pre-fills the expense form for one-click confirmation.

## Architecture

```text
User uploads/photographs receipt (image or PDF)
  │
  ReceiptUpload component → Supabase Storage (expense-receipts bucket)
  │
  Frontend calls edge function "scan-receipt"
    │
    Edge function:
      1. Downloads image from Supabase Storage via signed URL
      2. Converts to base64
      3. Sends to Lovable AI Gateway (Gemini 2.5 Flash - vision capable)
         with structured tool-calling to extract fields
      4. Returns extracted data: vendor, date, amount, currency, tax, category, line items
    │
  Frontend pre-fills ExpenseForm with extracted data
  User reviews, adjusts, and confirms
```

## What Gets Built

### 1. New Edge Function: `supabase/functions/scan-receipt/index.ts`

- Accepts `{ storage_path: string, business_currency: string, business_jurisdiction: string }` 
- Downloads the receipt image from Supabase Storage using a service-role signed URL
- Sends the image to Lovable AI Gateway using Gemini 2.5 Flash (vision model) with tool-calling for structured output
- Extraction schema:
  - `vendor_name` (string)
  - `date` (ISO date string)
  - `total_amount` (number)
  - `subtotal` (number, before tax)
  - `tax_amount` (number)
  - `tax_rate` (percentage)
  - `currency` (ISO 4217 code)
  - `category` (one of the existing EXPENSE_CATEGORIES values)
  - `description` (summary of purchase)
  - `line_items` (array of { description, quantity, unit_price, amount })
  - `confidence` (0-1 score)
- Returns all extracted fields; frontend decides what to use
- Graceful error handling: if extraction fails partially, returns what it could extract

### 2. Updated `ReceiptUpload` Component

- After successful upload, show a new "Scan & Extract" button (with a sparkle/wand icon)
- Clicking it triggers the scan-receipt edge function
- Shows a scanning animation/progress state
- On success, fires a new `onScanComplete` callback with extracted data

### 3. Updated `ExpenseForm` Component

- Receives scanned data from ReceiptUpload and auto-fills form fields
- Pre-fills: category, amount, vendor, date, description, notes (line items summary), tax fields
- Shows a subtle "AI-extracted" badge next to auto-filled fields so the user knows to review
- User can modify any field before saving
- Currency mismatch handling: if scanned currency differs from active currency account, show a warning

### 4. Updated `ExpenseEditDialog` Component

- Same scan capability when editing an expense with a receipt attached

### 5. No Database Changes Required

The expenses table already has all needed columns: `amount`, `tax_amount`, `tax_rate`, `vendor`, `category`, `expense_date`, `description`, `notes`, `receipt_url`.

## AI Prompt Design

The system prompt will instruct the model to:
- Act as a professional bookkeeper analyzing a receipt/invoice image
- Extract all financial data with precision
- Map categories to the app's predefined list (software, equipment, travel, meals, office, marketing, professional, utilities, rent, insurance, taxes, payroll, other)
- Detect currency from symbols, country context, or explicit labels
- Extract tax information per jurisdiction norms (VAT, GST, Sales Tax, etc.)
- Return confidence scores so the UI can flag low-confidence extractions

## Compliance Coverage

The extracted data stored alongside the original receipt image satisfies digital documentation requirements for:
- **IRS** (US): Digital copies acceptable under Rev. Proc. 98-25
- **HMRC** (UK): Digital records valid under Making Tax Digital
- **CRA** (Canada): Electronic images acceptable per IC05-1R1
- **ATO** (Australia): Digital copies valid per TR 2021/3
- **FIRS** (Nigeria): Digital records acceptable under FIRS guidelines
- The original receipt image is retained in cloud storage as the source document

## Multi-Currency Support

- The AI model detects the receipt's currency from visual cues (symbols, text)
- If the detected currency matches the active currency account, amount is used directly
- If different, a warning is shown and the user can adjust or note the foreign currency

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/scan-receipt/index.ts` | New edge function: AI-powered receipt OCR via Gemini vision |
| `src/components/accounting/ReceiptUpload.tsx` | Add "Scan & Extract" button after upload, scanning state, onScanComplete callback |
| `src/components/accounting/ExpenseForm.tsx` | Accept scanned data, auto-fill form, show AI-extracted badges |
| `src/components/accounting/ExpenseEditDialog.tsx` | Same scan integration for editing |

## UX Flow

1. User clicks "Add Expense" or uses the existing upload zone
2. User uploads a photo of their physical receipt (camera capture on mobile, file picker on desktop)
3. Receipt uploads to storage (existing flow)
4. A "Scan Receipt" button appears next to the uploaded receipt preview
5. User clicks it; a scanning animation plays (~2-3 seconds)
6. Form fields auto-populate with extracted data, each marked with a small AI indicator
7. User reviews, corrects if needed, and saves
8. Both the original image and structured data are stored for compliance
