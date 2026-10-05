# Show the business name on issued invoices

## Goal
Display the issuer’s actual business name on public invoice pages and generated PDFs when the legal name is blank.

## Confirmed cause
The invoice shown in the screenshot has a saved `business_name`, but no non-empty `legal_name`. The public invoice page checks `legal_name` and the legacy `name` field, so it falls back to the generic word “Business”. The PDF generator uses the same incomplete fallback and would show “Invoicemonk User”. The Invoicemonk watermark is separate platform branding and is expected.

## Implementation
- Update the public invoice view to resolve the issuer name in this order: legal name, business name, legacy name, then a neutral fallback.
- Apply the same fallback order to generated invoice PDFs so both representations use the saved snapshot consistently.
- Leave issued snapshots, invoice records, and database behavior unchanged; no migration or historical-record rewrite is needed.
- Add or update focused tests for snapshots with legal name, business name only, legacy name only, and no name.
- Record this work in the project roadmap.

## Verification
- Run focused tests, type checks, and the available project test/build checks.
- Confirm the public invoice page and PDF name-selection use `business_name` when `legal_name` is empty.
- Review the preview at desktop and mobile widths where the invoice page is accessible.
