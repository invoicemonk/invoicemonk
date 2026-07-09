# PostHog Onboarding Funnel

Create this funnel in PostHog → Insights → New → Funnel.

## Steps (in order)

1. `onboarding_signup_viewed`
2. `onboarding_signup_completed`
3. `onboarding_email_verified`
4. `onboarding_free_plan_entered` — user landed in the app on the free plan
5. `onboarding_first_invoice_created`
6. `onboarding_activated`

### Optional paid-conversion sub-funnel

Split off from step 4 or later:

1. `onboarding_plan_viewed` (visited `/select-plan` from an upgrade trigger)
2. `onboarding_plan_selected`
3. `checkout_payment_failed` OR successful redirect to Stripe
4. Stripe webhook → `subscription.created` (mirror this to PostHog if you want it in-funnel)

## Suggested breakdowns

- `referral_code` (already attached to every event by `trackFunnel`)
- `$geoip_country_code` (auto)
- `$initial_referring_domain`

## Conversion window

Set to **7 days** for the main funnel and **30 days** for the paid sub-funnel.

## Events emitted from code

All events go through `src/lib/funnel-tracking.ts → trackFunnel(event, props)`. Add new events to the `OnboardingEvent` union there before using them.
