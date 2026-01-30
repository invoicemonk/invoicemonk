
# Plan: Official Compliance Sample Invoice Generation

## Overview
Generate two official sample invoices (B2B/B2G and B2C) for regulatory submission using the actual system rendering pipeline. These will demonstrate true system output without being actual invoices stored in the database.

## Architecture Approach

The samples will be generated via a new **administrative edge function** that:
1. Uses the exact same HTML rendering logic as `generate-pdf`
2. Creates sample data structures matching the real invoice schema
3. Forces Professional tier settings (no watermark, custom branding)
4. Generates proper audit evidence
5. Returns downloadable HTML (print-to-PDF via browser)

```text
+-------------------+     +-------------------------+     +----------------+
|  Admin Request    | --> | generate-compliance-    | --> | PDF-ready HTML |
| (with admin auth) |     | samples edge function   |     | (print to PDF) |
+-------------------+     +-------------------------+     +----------------+
                                    |
                                    v
                          +-------------------+
                          | Audit Log Entry   |
                          | DATA_EXPORTED     |
                          +-------------------+
```

## Sample Invoice Specifications

### B2B/B2G Invoice Sample

| Field | Value |
|-------|-------|
| `invoice_number` | INV-SAMPLE-B2B-001 |
| `status` | issued |
| `currency` | NGN |

**Issuer Snapshot (issuer_snapshot):**
```json
{
  "legal_name": "TechVentures Nigeria Limited",
  "name": "TechVentures NG",
  "tax_id": "12345678-0001",
  "jurisdiction": "NG",
  "contact_email": "billing@techventures.ng",
  "contact_phone": "+234 1 234 5678",
  "address": {
    "street": "42 Broad Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria",
    "postal_code": "101001"
  },
  "logo_url": null
}
```

**Recipient Snapshot (recipient_snapshot) - Business:**
```json
{
  "name": "Federal Ministry of Finance",
  "tax_id": "FMF-GOV-98765",
  "email": "procurement@finance.gov.ng",
  "phone": "+234 9 876 5432",
  "address": {
    "street": "Central Business District",
    "city": "Abuja",
    "state": "FCT",
    "country": "Nigeria"
  }
}
```

**Tax Schema Snapshot (tax_schema_snapshot):**
```json
{
  "name": "Nigeria VAT Standard",
  "jurisdiction": "NG",
  "version": "2024.1",
  "rates": [
    { "name": "VAT", "rate": 7.5, "type": "percentage" }
  ]
}
```

**Line Items:**
| Description | Qty | Unit Price | Tax Rate | Amount |
|-------------|-----|------------|----------|--------|
| Enterprise Software License (Annual) | 1 | ₦2,500,000 | 7.5% | ₦2,500,000 |
| Implementation & Training Services | 40 | ₦75,000 | 7.5% | ₦3,000,000 |
| Premium Support Package (12 months) | 1 | ₦500,000 | 7.5% | ₦500,000 |

**Totals:**
- Subtotal: ₦6,000,000
- VAT (7.5%): ₦450,000
- **Total: ₦6,450,000**

**Future Government Fields (marked as not submitted):**
```json
{
  "irn": null,
  "nrs_submission_status": "not_submitted",
  "government_signature": null,
  "submission_timestamp": null
}
```

### B2C Invoice Sample

| Field | Value |
|-------|-------|
| `invoice_number` | INV-SAMPLE-B2C-001 |
| `status` | issued |
| `currency` | NGN |

**Issuer Snapshot:** (Same as B2B)

**Recipient Snapshot (recipient_snapshot) - Individual:**
```json
{
  "name": "Adaeze Okonkwo",
  "tax_id": null,
  "email": "adaeze.okonkwo@email.com",
  "phone": "+234 803 123 4567",
  "address": {
    "street": "15 Victoria Island Way",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  }
}
```

**Line Items (Simplified):**
| Description | Qty | Unit Price | Amount |
|-------------|-----|------------|--------|
| Professional Consulting Services | 8 | ₦50,000 | ₦400,000 |
| Travel & Logistics (Reimbursable) | 1 | ₦35,000 | ₦35,000 |

**Totals:**
- Subtotal: ₦435,000
- VAT (7.5%): ₦32,625
- **Total: ₦467,625**

## Implementation Details

### 1. New Edge Function: `generate-compliance-samples`

**File:** `supabase/functions/generate-compliance-samples/index.ts`

**Features:**
- Requires platform_admin role authentication
- Accepts `sample_type` parameter: `b2b` or `b2c`
- Uses exact same HTML template as `generate-pdf`
- Forces `showWatermark = false` and `canUseBranding = true`
- Generates unique verification_id and hash for each generation
- Logs `DATA_EXPORTED` audit event with compliance metadata

**Security:**
- Only accessible by platform admins
- All requests logged to audit trail
- No actual database records created

### 2. HTML Enhancements for Compliance Samples

Add to PDF output:
- **Header badge:** "COMPLIANCE SAMPLE - FOR REGULATORY REVIEW"
- **Integrity notice in footer:** "This invoice is immutable and verifiable via InvoiceMonk platform"
- **Verification URL:** Working QR code pointing to verification portal
- **Timestamp:** Exact ISO 8601 generation timestamp
- **Hash display:** Full invoice_hash (not truncated for samples)

### 3. Audit Trail Requirements

Each sample generation creates audit log:
```json
{
  "event_type": "DATA_EXPORTED",
  "entity_type": "compliance_sample",
  "entity_id": null,
  "metadata": {
    "sample_type": "b2b",
    "export_type": "compliance_sample_pdf",
    "invoice_number": "INV-SAMPLE-B2B-001",
    "generated_at": "2026-01-30T12:00:00.000Z",
    "purpose": "regulatory_submission",
    "verification_id": "uuid...",
    "invoice_hash": "sha256..."
  }
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/generate-compliance-samples/index.ts` | Create | New edge function for sample generation |
| `supabase/config.toml` | Modify | Add function configuration with `verify_jwt = false` |

## Technical Specifications

### Invoice Hash Generation
Uses same algorithm as production:
```typescript
const invoice_hash = encode(sha256(
  (invoice_number + issued_at.toISOString())::BYTEA
), 'hex')
```

### Verification ID
Real UUID generated per sample:
```typescript
const verification_id = crypto.randomUUID()
```

### Template Snapshot
```json
{
  "name": "Professional Standard",
  "watermark_required": false,
  "supports_branding": true,
  "tier_required": "professional"
}
```

## Output File Naming

The edge function returns HTML with proper filename headers:
- B2B: `invoicemonk_b2b_b2g_invoice_sample.html` (user prints to PDF)
- B2C: `invoicemonk_b2c_invoice_sample.html` (user prints to PDF)

## Validation Checklist (Built into Function)

The function validates before returning:
1. Invoice hash is generated and matches algorithm
2. Verification URL is properly formatted
3. All snapshot fields match schema exactly
4. No hardcoded demo values outside defined samples
5. Audit log entry created successfully

## Usage

Platform admin calls the endpoint:
```bash
# B2B Sample
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"sample_type": "b2b"}' \
  https://skcxogeaerudoadluexz.supabase.co/functions/v1/generate-compliance-samples

# B2C Sample  
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"sample_type": "b2c"}' \
  https://skcxogeaerudoadluexz.supabase.co/functions/v1/generate-compliance-samples
```

Response: HTML document ready for browser print-to-PDF.

## Summary

This approach ensures:
- Samples are generated through real system logic
- All fields match the actual database schema
- Future government fields are properly marked as null/not_submitted
- Professional tier rendering (no watermark)
- Complete audit trail for compliance
- Verification URLs will work (edge function can recognize sample verification IDs)
- Output is defensible as "true system output"
