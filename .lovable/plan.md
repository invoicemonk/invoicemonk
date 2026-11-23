# Restore the signup security check

The screenshot shows the signup page’s Cloudflare security check failing to load. The page currently loads Turnstile dynamically and has a retry message; the exact failure cause is not yet confirmed. The app’s security policy also needs review because the current signup path can continue when the widget or server verification is unavailable.

## Work

1. Trace Turnstile loading on the signup page in preview and production, including script requests, render callbacks, domain/site-key configuration, and the server verification secret.
2. Fix the loading and retry lifecycle so the widget renders reliably and reports actionable errors when Cloudflare cannot load it.
3. Ensure signup cannot silently bypass required verification: submit a valid token for server-side verification and fail safely if verification is missing or unavailable. Do not expose secret values.
4. Verify successful and failed verification paths and check for regressions in signup.

## Technical details

- Keep the change limited to signup security verification and its necessary configuration.
- Preserve the existing signup form and authentication flow; do not change plan selection or onboarding.
- If a required Cloudflare secret is not configured, pause enforcement changes until it is available rather than weakening the check.