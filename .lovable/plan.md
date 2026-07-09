## Candid diagnosis

Looking at your funnel, the drop-off almost certainly is **not** "wrong audience" or "$15 is too expensive." Freelancers happily pay $15 for invoicing tools. The problem is structural:

**You force a credit card before the user has seen a single invoice.**

Current flow: Signup → Verify email → **PlanSelection (Pro $19 or SME $49, no free option, no trial)** → Stripe Checkout → Onboarding → Dashboard.

There is no free tier, no free trial, no "look around first." A first-time visitor who has never seen the product is asked to type card details for $19–$49/mo. Industry benchmark for that pattern is 95–99% drop-off. What you're seeing is the expected outcome of the design, not a mystery.

Secondary contributors (smaller, but real):

- No social proof on the plan page (no logos, no testimonials, no user count).
- No "what happens after I pay" preview — the dashboard is invisible until after checkout.
- Plan page copy is generic ("Pick a plan to start using Invoicemonk") — doesn't restate value or reduce risk.
- No money-back guarantee, no "cancel anytime" reassurance near the CTA (it's in the subheader, not next to the button).
- Only two paid tiers + "Contact Sales" — a solo freelancer sees nothing sized for them.

## How competitors solved this


| Tool                   | Acquisition model                                                     | Why it works                                                                            |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Wave**               | Free forever for invoicing + accounting; monetizes payments & payroll | Removes the entire signup-to-value gap. Users invite themselves in.                     |
| **Zoho Invoice**       | 100% free, unlimited                                                  | Uses invoicing as top-of-funnel for the Zoho suite. Massive share of freelancer market. |
| **FreshBooks**         | 30-day free trial, no card required                                   | Users experience value before any payment question.                                     |
| **QuickBooks**         | 30-day trial OR 50% off 3 months, no card for trial                   | Two paths — commitment discount or risk-free trial.                                     |
| **Xero**               | 30-day free trial, no card required                                   | Same pattern; card only when trial converts.                                            |
| **Invoice Ninja**      | Free self-hosted tier + paid cloud                                    | Free forever anchor; paid is an upgrade, not a gate.                                    |
| **Bonsai / HoneyBook** | 7-day trial, then paid                                                | Shorter trial but still card-later.                                                     |


The universal pattern: **let people use the product before asking for money.** Nobody who has scaled past your paywalls at signup.

## Recommendation (ranked by impact)

### 1. Remove the paywall from onboarding (biggest single lever)

Replace the current PlanSelection step with one of:

- **Option A — Free tier (recommended):** Add a real Free plan (e.g. 3 invoices/month, 1 client, Invoicemonk-branded PDF). Route new signups straight to onboarding + dashboard. Show upgrade prompts contextually when they hit a limit.
- **Option B — 14-day trial, no card:** Skip PlanSelection at signup entirely. Grant Pro features for 14 days. Ask for a card on day 12 via banner + email.
- **Option C — Hybrid (what Zoho / QuickBooks do):** Free tier + optional "Start 14-day Pro trial" CTA on the same page.

Either A or C is what I'd ship. Option B is second best, but you still bleed users at day 14 without a free fallback.

### 2. Move PlanSelection *after* the aha moment

The user should send their first invoice, or at minimum see their dashboard populated, before ever seeing a pricing page. Trigger the upgrade flow from:

- Hitting a feature limit (client cap, invoice cap, team members).
- Trying to use a gated feature (e-invoicing, custom branding, accounting).
- A soft "Upgrade" nudge in the sidebar after N days.

### 3. Add trust signals *on* the current PlanSelection (for users who do get there)

- Real testimonials with photo + business name (3 minimum).
- "Cancel anytime, no questions asked" directly under the CTA button.
- 14- or 30-day money-back guarantee badge.
- "Trusted by X businesses in Y countries" counter (real numbers, even small).
- Logos of payment/compliance partners already in your footer (Stripe, jurisdictions you cover).
- FAQ accordion: "Can I cancel?" / "Do you store my card?" / "What if my business is too small?"

### 4. Add a solo/starter price point

$19 is a big first step. Add a **Solo/Starter at $6–9/mo** (1 user, unlimited invoices, no accounting). This is what freelancers actually compare against Wave-free and Zoho-free. Reserve $19 Pro for people who need accounting/team.

### 5. Instrument the funnel properly

You already have `trackFunnel` events for `onboarding_plan_viewed` → `onboarding_plan_selected` → checkout. Add a PostHog funnel dashboard for:
`signup_viewed → signup_completed → email_verified → plan_viewed → plan_selected → checkout_started → checkout_completed → first_invoice_created`

Right now you're guessing where the drop happens. With this funnel you'll know within a week.

### 6. Reduce email-verification drop

Between signup and plan selection sits email verification — a known 20–40% leak. Let users into a read-only dashboard while unverified, and only block send-invoice / checkout until they verify.

## What I'd ship first (if you want a single concrete first move)

Ship **#1 Option A (Free tier) + #2 (defer paywall) + #5 (funnel instrumentation)** together. That's the change that competitors made, and it's the change that will actually move your number. Everything else is optimization on top.

## What I need from you to build it

1. Which route do you want: **Free tier**, **no-card trial**.
2. If free tier: what limits feel right? (I'll suggest 3 invoices/mo, 1 client, 1 user, Invoicemonk-branded PDF, no accounting.) Agee
3. Should I also wire a PostHog funnel dashboard config? Yes please

Answer those, and I'll come back with a concrete implementation plan (schema changes to tier_limits, PlanSelection removal from onboarding, feature-gated upgrade prompts, testimonial + guarantee UI on the pricing page).