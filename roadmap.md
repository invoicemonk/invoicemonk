# Product activation & discovery

- [x] Phase 1: product inventory, event foundation, instrumentation
- [x] Phase 2: capability registry, optional stated-intent capture
- [x] Make the dashboard intent question focused and repeat it next visit when skipped
- [x] Phase 3: activation/abandonment records + daily job
- [x] Phase 4: contextual feedback and prompt throttling
- [x] Phase 5: lifecycle email safety — TEST MODE ONLY
- [x] Phase 6: admin Product Discovery dashboard
- [x] Audit follow-up: discovery area, per-workflow journeys, per-product rules, reactivation
- [x] Admin user timeline (stated / observed / inferred), dashboard filters, overview, funnel
- [x] Product feedback tab in Admin Feedback, once-per-visit prompt limit
- [x] Email processor reads DB config, logs every decision, dry-run, cooldown/duplicate check
- [x] Product tip email + opt-out switch (drafted; off until copy approved and enabled)
- [x] Phase 7: journey checks B,C,E,F,G,J,K passed in database; email rules (L) tested
- [x] Phase 7: database checks for A, H, I passed
- [ ] Phase 7: D and L dashboard checks, signed-in browser runs of A–L (blocked: needs test account secrets TEST_USER/TEST_PASS)
- [x] Product tip email copy redesigned around recorded journeys; awaiting review before any campaign enablement
- [x] Require a stated product-discovery answer before users enter onboarding setup

# Form validation rollout

- [ ] Add shared accessible field-error helpers
- [ ] Add full missing-field highlighting and first-error focus to onboarding
- [ ] Update core creation/editing forms
- [ ] Update settings, payment, invitation, auth, and send forms
- [ ] Add validation tests and verify desktop/mobile behavior
- [ ] Run type checks, tests, production build, and review roadmap

# Invoice identity display

- [x] Prefer the saved business name when the legal name is blank on public invoice pages and generated PDFs
- [x] Add coverage for legal, business, legacy, and missing issuer names
