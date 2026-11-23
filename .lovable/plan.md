# Fix signup security and onboarding blockers

The screenshot shows the signup page’s Cloudflare check failing. The Turnstile script loads in a local preview, but the widget does not render and a Cloudflare request returns 400; the deployed preview’s host configuration remains unverified. A separate plan-selection loop is confirmed: new users are marked as not having selected a plan, but “Stay on Free” only opens the dashboard, which redirects them back to plan selection. The starter/free tier is present. The annual Professional subscriber checked is active, has saved discovery answers, and is currently at payment setup with no payment method saved.

## Work

1. Make new signup paid-only: remove the Free choice and prevent dashboard or direct-route bypasses. Enter setup only after the selected paid plan is confirmed active; failed or canceled checkout returns to plan selection. Preserve existing accounts and their current access.
2. Confirm Cloudflare’s site-key host configuration and server secret, then fix Turnstile rendering/retry behavior and preserve strict server-side verification. Do not expose secret values or silently bypass the check.
3. Leave the paid subscriber’s active subscription and other records unchanged. Confirm the user can resume at the payment-method step; report any required fields or reproducible save failure without inferring a cause that the records do not show.
4. Verify paid checkout, canceled/failed checkout, subscription confirmation, Turnstile success/failure, and signup regressions.

## Technical details

- Keep changes limited to signup security, plan-choice routing, and verified onboarding blockers.
- The selected policy is paid-only for new signups; do not remove or alter existing accounts or their access as part of this change.
- If a required Cloudflare secret is missing, pause enforcement changes until it is available rather than weakening the check.