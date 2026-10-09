# Branded, controlled dormant-research email sending

## Goal
Make dormant-user research emails recognizable, understandable, and manually sendable to eligible users from Product Discovery.

## Confirmed behavior
- “Log response” saves a reply received outside the app in `product_feedback`; it stops that user’s remaining research emails. It does not send an email.
- The research email HTML currently has no Invoicemonk logo or standard footer; the preview displays the renderer output directly.
- The connected database currently has research campaigns disabled, test mode enabled, and an empty test-recipient allowlist. The admin send flow must not silently bypass these safeguards.

## Implementation
- Update the shared research-email renderer so both the preview and delivered message use the established Invoicemonk email logo and footer; show the subject and realistic branded email in the preview.
- Clarify the response action as recording a reply, with short explanatory copy that it is used for replies received elsewhere and stops the sequence.
- Add per-user and bulk sending controls for Email 1, 2, or 3, with a confirmation showing the chosen step and recipient count. Only include users whose next sequence step is exactly the selected email; retain the existing timing, segment exclusions, reply-stop, opt-out, duplicate/cooldown, and deliverability-cap safeguards. Do not allow manual step overrides.
- Send through a dedicated authenticated admin-only server function, validate the request, render using the shared template, and record sent, failed, suppressed, and test-mode decisions in `lifecycle_email_deliveries`.
- Respect the strictest existing environment and database test-mode/allowlist settings. If those settings block delivery to the selected customers, explain that in the admin screen instead of silently sending, changing the settings, or reporting success.
- Keep the send action separate from scheduled campaign processing; no direct browser-to-email-provider calls. No schema changes unless implementation reveals the existing delivery log cannot record required outcomes.
- Record the feature in `roadmap.md` and the relevant security/architecture rule in `AGENTS.md`.

## Verification
- Test email rendering for logo/footer parity and escaped user-provided name/reason content.
- Test sequence-step eligibility, exclusions, opt-outs, duplicate/cooldown handling, test-mode blocks, and admin authorization.
- Run focused edge-function tests and frontend checks; verify preview and blocked/success states in the admin screen where available.
