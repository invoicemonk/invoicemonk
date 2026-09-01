# Simplify the New Invoice workflow

## Goal
Make creating and editing an invoice easier to understand by showing the required workflow first, clearly marking optional choices, and giving every section a concise contextual help control.

## User-facing structure
Apply the same structure to both **New Invoice** and **Edit Invoice**:

1. **Client** — select or create the recipient; keep B2B/TIN guidance close to the client choice.
2. **What are you billing for?** — line items, quantity, price, and applicable tax inputs. Keep the empty/invalid state prominent so users know what is required.
3. **Invoice details** — issue date, due date, currency, and the short invoice summary.
4. **Payment method** — shown as an optional step with clear wording about what happens if none is configured.
5. **Notes and payment terms** — shown as optional, lower-priority content.
6. **Advanced options** — collapsed by default and containing template/branding, deposit or final invoice settings, reverse charge, and other compliance-specific controls that are only relevant in certain cases.

Keep the totals and save/issue actions visible in the sticky summary area. Preserve all existing validation, compliance gates, calculations, and mutation behavior.

## Help and clarity
- Add a reusable section-heading pattern with a small `?` help button for Client, Line Items, Invoice Details, Payment Method, Notes & Terms, and Advanced Options.
- Use accessible tooltip content written in plain language, including whether a section is required or optional and what it affects on the final invoice.
- Add explicit “Required” or “Optional” language where it reduces uncertainty, without turning the page into a tutorial.
- Keep help available on keyboard focus and touch-friendly through the existing tooltip primitives.

## Technical implementation
- Create a small shared invoice-form section header/help component so New and Edit cannot drift apart.
- Use the existing Radix Collapsible and semantic design tokens; do not introduce new visual styling systems or hardcoded component colors.
- Reorder existing JSX rather than duplicating business logic. Move template/branding out of the verification warning card and into Advanced Options.
- Make Advanced Options open automatically when an existing invoice contains advanced settings, or when a user has selected an advanced mode, so editing never hides active configuration.
- Keep conditionally relevant alerts (email verification, tier watermark, jurisdiction tax information, profile completeness) outside the collapsible area when they block issuance; keep informational advanced controls inside it.
- Ensure responsive behavior remains usable on mobile and desktop, with the summary/actions continuing to work without overlap.

## Validation
- Verify New and Edit render the same section order and help affordances.
- Verify collapsed advanced settings preserve and update template, brand color, deposit/final, reverse-charge, and compliance values.
- Verify required-field validation, Save Draft/Save Changes, Preview, and Issue Invoice behavior is unchanged.
- Check keyboard focus, tooltip accessibility, mobile layout, and the existing invoice form tests/type checks.
