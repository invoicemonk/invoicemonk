# Fix Stripe webhook signature failures

## What the error means

Stripe signs every webhook with the signing secret of the *specific endpoint* it was sent to. `No signatures found matching the expected signature for payload` means the body reaching our function did not verify against the secret that function used. Two possible causes:

1. Wrong/rotated signing secret for that endpoint (most common).
2. The body was altered before verification (not the case here — see below).

## What I verified in the code

- `supabase/functions/stripe-webhook/index.ts` reads `await req.text()` (raw body) and calls `constructEventAsync` with `STRIPE_WEBHOOK_SECRET`.
- `supabase/functions/stripe-connect-webhook/index.ts` does the same with `STRIPE_CONNECT_WEBHOOK_SECRET`.

So both handlers already pass the exact raw body — the code is not mangling the payload. That points at a secret/endpoint mismatch.

Unconfirmed: which of the two functions raised the Sentry event. Both tag Sentry with `function_name`, but the message you pasted doesn't include it, so step 1 is to identify it rather than guess. Also note the secret list visible to me shows `STRIPE_WEBHOOK_SECRET` but no `STRIPE_CONNECT_WEBHOOK_SECRET`; that list may be incomplete for the live project, so it needs checking rather than assuming.

## Plan

1. **Identify the failing endpoint.** In Sentry, open the event and read the `function_name` tag (`stripe-webhook` vs `stripe-connect-webhook`). If unavailable, the added logging in step 3 will surface it on the next event.
2. **Re-sync the signing secret** for that endpoint: copy the signing secret from the matching endpoint in the Stripe Dashboard (Developers → Webhooks → the endpoint whose URL ends in that function name) and save it as `STRIPE_WEBHOOK_SECRET` or `STRIPE_CONNECT_WEBHOOK_SECRET` accordingly. If the Connect endpoint exists in Stripe but its secret was never stored, add it — otherwise the Connect webhook fails for every event.
3. **Make future failures self-diagnosing.** In both webhook functions, on verification failure log (non-secret) diagnostics: function name, event id from the unparsed body if present, the `stripe-signature` header timestamp, body length, and whether the expected secret env var was present and its prefix shape (`whsec_` yes/no). Send the same fields as Sentry tags. No secret values logged.
4. **Reject clearly.** Keep the 400 response, but return a short machine-readable reason (`signature_mismatch`) so Stripe's dashboard attempt list and our logs agree.
5. **Verify.** After the secret is saved, resend a recent failed event from the Stripe Dashboard ("Resend" on the endpoint's attempt) and confirm a 200 plus the expected DB side effect. Also confirm no new Sentry events appear.

## Technical notes

- Only the two webhook functions change; no schema or frontend changes.
- Signature verification stays mandatory — no dev bypass is added.
- If the Sentry event turns out to come from an endpoint we no longer use (e.g. an old duplicate endpoint in Stripe pointing at one of these URLs with a different secret), the fix is to delete that endpoint in Stripe rather than change code.
