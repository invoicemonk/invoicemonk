# Highlight missing required fields across user-facing forms

## Goal
Make missed required fields immediately identifiable throughout Invoicemonk. After an invalid submission, every missing or invalid required field will remain highlighted in red with a clear inline message until corrected, and focus will move to the first error.

## Implementation

1. **Standardize the validation experience**
   - Reuse the existing form controls and semantic error colors.
   - Give invalid controls a red border/ring, connect each message to its control for screen readers, and mark it invalid accessibly.
   - Clear each field's red state as soon as its value becomes valid.
   - Keep error toasts only as a short summary where useful; the toast will no longer be the sole explanation.

2. **Fix onboarding first**
   - Replace the current first-error-only result with a field-level error map for each onboarding step.
   - Highlight all missing fields on the active step at once, including selects, business identity fields, address details, tax details, and required payment instructions.
   - Focus and scroll to the first invalid field after Continue or Finish is pressed.
   - Preserve jurisdiction- and entity-dependent requirements, optional logo behavior, saved progress, and completion navigation.

3. **Apply the same behavior to all user-facing forms**
   - Audit and update creation, editing, settings, authentication, invitation, payment, and submission forms—not admin-only operational tools.
   - Cover core workflows including invoices, clients, expenses, vendors, products/services, business profile, payment methods, online payments, team invitations, partner application, account actions, and send dialogs.
   - Preserve forms that already show correct inline errors, while adding red control states and first-error focus where missing.
   - Handle custom controls such as selects, radio groups, checkboxes, date controls, and collapsible sections; open a collapsed section when it contains the first error.

4. **Keep validation rules secure and consistent**
   - Continue using the existing schemas and length limits where present.
   - Add or consolidate Zod schemas for forms that currently rely only on submit-handler checks.
   - Keep server/database validation as the final authority; server errors remain visible without replacing field-level client feedback.
   - Never render user-provided HTML or pass unvalidated values to external destinations.

5. **Verify the complete behavior**
   - Add focused tests for multiple simultaneous errors, clearing corrected errors, conditional required fields, and first-error focus.
   - Test onboarding and representative short, long, dialog, and custom-select forms by keyboard on desktop and mobile widths.
   - Confirm valid submissions still save normally and no optional field is incorrectly marked required.
   - Run type checks, relevant tests, and the production build.

## Technical details
- Prefer the existing React Hook Form, Zod, and shared form-message patterns where already used.
- For complex state-managed screens, use typed field-error maps rather than risky full rewrites.
- Use stable field IDs/refs and `aria-invalid` plus `aria-describedby`; apply semantic `destructive` design tokens rather than hardcoded colors.
- Scope is all user-facing forms. Admin-only forms are excluded unless they share a user-facing component.
