

# Fix Modern Template PDF Issues

## Issues Identified

1. **Logo above instead of beside**: In `buildModernPdf` (line 606-612), the logo is stacked above "INVOICE" text in the same column. It should be in a separate column beside the invoice text.

2. **Multi-colored text in header**: pdfmake doesn't support hex-with-alpha (`#ffffffdd`, `#ffffffcc`) or `rgba()`. These render unpredictably. All header text should be plain `#ffffff`.

3. **Currency causing line overflow**: `formatCurrencyPdf` outputs `NGN 1,500,000.00` — the full currency code prefix is too long for narrow columns. Should use currency symbol (e.g., `₦`) instead.

4. **Underscores in payment keys**: `buildPaymentContent` (line 312) displays raw object keys like `bank_name`, `account_name`. Need to convert to "Bank Name", "Account Name".

## Changes in `supabase/functions/send-invoice-email/index.ts`

### Fix 1: Logo beside invoice text (lines 606-612)
Change the header from a single-column stack (logo above text) to a `columns` layout:
```
columns: [
  // Logo column (if present)
  ...(logo ? [{ image: logo, width: 50, ... }] : []),
  // Text column with INVOICE + number
  { stack: [
    { text: 'INVOICE', ... color: '#ffffff' },
    { text: invoiceNumber, ... color: '#ffffff' }
  ] }
]
```

### Fix 2: White text throughout header (lines 610-618)
- Change `#ffffffcc` → `'#ffffff'`
- Change `#ffffffdd` → `'#ffffff'`
- Change `fillColor: 'rgba(255,255,255,0.2)'` → `fillColor: '#ffffff'` with `color: brandColor` for the badge text (inverted badge)

### Fix 3: Currency symbol in `formatCurrencyPdf` (lines 158-165)
Add a symbol map and use symbol instead of code:
```typescript
const formatCurrencyPdf = (amount: number, currency: string): string => {
  const symbols: Record<string, string> = {
    NGN: '₦', USD: '$', EUR: '€', GBP: '£', ...
  }
  const symbol = symbols[currency] || currency
  const formatted = new Intl.NumberFormat('en-US', { ... }).format(amount)
  return `${symbol}${formatted}`
}
```

### Fix 4: Format payment instruction keys (lines 312-316)
Replace raw key display with a formatting helper:
```typescript
const formatKey = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
```
Apply to the `text: k` in `buildPaymentContent`.

### Files
- `supabase/functions/send-invoice-email/index.ts`

