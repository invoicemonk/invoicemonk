# Eliminate blank login and signup pages

## Confirmed findings

- `index.html` loads Contentsquare synchronously in `<head>` before `<body>` and the React entry script. When that request was deliberately stalled against the production URL, `DOMContentLoaded` timed out and even the page body was unavailable, reproducing the fully blank screen visitors saw.
- Production currently ships a single ~3.9 MB JavaScript entry bundle. `App.tsx` eagerly imports most dashboard, admin, demo, and marketing pages, so login/signup visitors must download, parse, and execute unrelated application code before seeing the form.
- The current Sentry error boundary is mounted only after startup succeeds. Import, initialization, blocked-storage, or root-mount failures can therefore leave `#root` empty with no recovery UI.
- The signup page's Cloudflare Turnstile script is currently rejected by the production Content Security Policy. The page still renders, but CAPTCHA readiness and signup protection are unreliable.
- The Tawk script is requested with an invalid cross-origin configuration and fails in the production browser console. This is not the blank-screen cause, but it is another avoidable auth-page startup error.

## Implementation

1. **Remove parser-blocking third-party startup**
   - Load Contentsquare asynchronously so it can never prevent the document body or React root from appearing.
   - Keep analytics failures isolated from application rendering.
   - Delay nonessential OneSignal and Tawk initialization until after the app has mounted; do not initialize push identity on public auth pages.

2. **Give visitors an immediate, resilient auth shell**
   - Render a lightweight branded loading state before importing the full application.
   - Replace the empty/one-line failure behavior with a branded recovery screen containing Reload and Return to login actions.
   - Catch application import, root initialization, and render errors outside the React tree, report the raw error to Sentry/PostHog when available, and always replace the loader with the recovery screen.
   - Add a startup timeout so a hung initialization cannot leave visitors waiting indefinitely.

3. **Reduce auth-route startup cost**
   - Convert non-auth route groups in `App.tsx` to lazy-loaded chunks so `/login` and `/signup` do not evaluate dashboard, admin, demo, reports, and marketing-shot code.
   - Preserve the existing routes and route-level loading states; this is a loading architecture change, not a navigation redesign.

4. **Repair auth-page third-party configuration**
   - Allow Cloudflare Turnstile's script/frame/connect origins in the production CSP and show a clear retry state if CAPTCHA cannot load.
   - Remove the incorrect Tawk `crossorigin` attribute and keep chat failure non-blocking.
   - Limit OneSignal's custom-domain initialization to the supported production hostname so preview/local warnings do not pollute diagnostics.

5. **Add regression coverage and validate production-like behavior**
   - Add tests for the startup timeout/error fallback and auth routes rendering when analytics, chat, push, or CAPTCHA scripts fail.
   - Validate `/login` and `/signup?plan=professional` at desktop and mobile sizes with normal networking, blocked third-party hosts, and throttled networking.
   - Confirm the auth form appears promptly, the page never remains blank, Turnstile is CSP-compliant, and browser console errors from these integrations are removed.

## Technical scope

Likely files: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/lib/onesignal.ts`, `src/components/TawkTo.tsx`, `src/pages/app/Signup.tsx`, `vercel.json`, plus focused startup/auth tests. No database or billing logic changes.