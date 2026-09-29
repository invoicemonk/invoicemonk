<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Supabase Storage: never move object keys with SQL

Storage resolves a file by `name` **and** `version` from `storage.objects`;
the backend object key is derived from both. Rewriting `name` (or `version`)
with `UPDATE storage.objects ...` leaves the bytes behind at the old key and
permanently orphans the file — this is what broke every business logo on
15 July 2026.

To move or rename a stored object, always use the Storage API
(`supabase.storage.from(bucket).copy(oldKey, newKey)` then `.remove([oldKey])`),
verify the new key downloads, and only then update any URLs in the database.

## Product activation tracking

- Product journey events live in `lifecycle_events` (columns product_area/workflow/stage/source); never create a parallel events table. Why: one store shared with lifecycle campaigns.
- Server-truth actions (invoices, expenses, payments, scans, etc.) are logged by DB triggers via `log_product_event`; only UI-only actions use `trackProductEvent()` (`src/lib/product-tracking.ts`). Why: covers web + mobile and can't be skipped by the client.
- Journey stage (started/progress/activated/outcome/repeat) is computed server-side per user + product area; users have many concurrent journeys. Why: activation ≠ outcome, repeat use is a first-class signal.
- `user_intents` stores STATED intent only; observed/inferred intent must be derived and labelled separately, never written there. Why: never misrepresent what users said.
- Product areas and their activation/outcome events are defined in `src/lib/product-registry.ts`. Why: single source of truth for later dashboards/emails.
- Lifecycle email delivery defaults to test mode and only permits explicitly allowlisted recipients. Why: activation experiments must never contact customers before approval.
- Stated intent (`user_intents`) is user-level while product journeys (`product_activation`) are per user + business + area + workflow. Why: intent describes the person; behaviour belongs to a business.
- Activation/abandonment windows live in `product_activation_rules` (one row per product area, optional workflow override). Why: one server-owned rules list the daily evaluator and summaries share.
- Lifecycle email safety settings live in `lifecycle_campaign_config`; env settings and DB settings combine so the strictest wins, and every send decision is logged to `lifecycle_email_deliveries`. Why: test mode can't be accidentally disabled from one place.
- Intent-prompt interactions use product area `discovery`, which is excluded from activation summaries. Why: skipping a question must not look like product usage.
