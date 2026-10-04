# Make onboarding product discovery mandatory

## User experience
- Replace the dismissible discovery banner in onboarding with a dedicated, blocking discovery step before business setup.
- Require at least one intent selection before users can continue; keep multi-select and the existing optional “Other” text field.
- Remove Skip, dismiss, and collapse actions from the onboarding version. Keep the verification-email and dashboard prompts optional and unchanged.
- Reuse the existing `user_intents` answers. Users who have already saved an answer are not asked again; users who have not answered cannot proceed to business setup.
- If saving fails, keep the step visible and show the existing error feedback so the user can retry.

## Implementation and verification
- Add an onboarding-only required mode to the shared intent prompt, or a focused onboarding view using the same options and save logic; avoid changing optional behavior on other surfaces.
- Gate entry to the existing onboarding steps on whether the authenticated user has a saved intent, including when resuming an incomplete onboarding session.
- Verify selection is required, successful save persists and unlocks onboarding, save failure does not unlock it, and refresh does not bypass the gate. Run relevant tests and check the preview at desktop and mobile sizes.

## Technical details
- Store only explicitly selected answers in the existing `user_intents` table. Do not add inferred intent or a parallel discovery store.
- Preserve existing product tracking for stated intent and discovery interactions; do not change unrelated activation tracking or onboarding fields.
