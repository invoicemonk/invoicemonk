## Root cause

The dashboard's Compliance card shows **TIN "Not set"** even though the value is saved in `business_sensitive_data` (verified in DB: `tax_id = '1031640657'`).

The Compliance card reads `currentBusiness.tax_id`, which `BusinessContext` fills by calling the `get_business_sensitive` RPC and merging the result into the business object. That RPC call is currently returning `403 permission denied` for the `authenticated` role, so the merge silently falls back to `null` and the card reports TIN as missing. Saving in Settings works (the row is written), but the next dashboard render can't read it back — that's why the value "disappears" after saving.

Network log confirms sibling RPCs on the same dashboard also fail with the same error:

```
POST /rpc/get_dashboard_stats  → 42501 permission denied for function get_dashboard_stats
POST /rpc/get_due_date_stats   → 42501 permission denied for function get_due_date_stats
```

Direct privilege check:

```
get_business_sensitive  authenticated=false  service_role=true
get_dashboard_stats     authenticated=false  service_role=true
get_due_date_stats      authenticated=false  service_role=true
```

A recent `CREATE OR REPLACE FUNCTION` migration dropped the `EXECUTE` grant to `authenticated` on these `SECURITY DEFINER` RPCs. Postgres does not preserve grants when a function's signature is replaced without re-granting.

## Fix

Single SQL migration that re-grants `EXECUTE` to `authenticated` on the client-facing RPCs currently missing it. No table/RLS/data changes, no code changes, no secret changes.

**Definitely required (directly reproduces the bug or shows up as 403 in the current session):**

- `get_business_sensitive`
- `get_business_sensitive_fields`
- `get_dashboard_stats`
- `get_due_date_stats`

**Also re-grant proactively** — same regression pattern, all called from the frontend, will 403 the same way if not already broken:

- Stats/analytics: `get_accounting_stats`, `get_cashflow_summary`, `get_expenses_by_category`, `get_profitability_stats`, `get_receivables_intelligence`, `get_revenue_trend`
- Tier/limits: `has_tier`, `check_tier_limit`, `check_tier_limit_business`, `check_currency_account_limit`, `check_payment_method_limit`, `check_receipt_limit`, `check_team_member_limit`
- Actions the app calls: `issue_invoice`, `log_audit_event`, `create_notification`, `create_regulatory_submission`, `update_submission_status`, `lock_business_currency`, `close_account`, `check_disposable_email`, `check_rate_limit`
- Admin-panel RPCs called from the client: `admin_get_business_documents`, `admin_get_verification_queue`, `admin_paid_intent_lost_count`, `admin_set_verification`, `ban_user`, `unban_user`, `get_platform_admin_emails`

Each function keeps its existing `SECURITY DEFINER` + internal auth checks (e.g. `has_role`, `has_business_role`), so re-granting `EXECUTE` to `authenticated` does not widen access — it just lets the API layer reach the function so the internal checks can run.

Migration shape:

```sql
GRANT EXECUTE ON FUNCTION public.get_business_sensitive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, uuid, timestamptz, timestamptz) TO authenticated;
-- …one line per function above, using the exact signature from pg_proc
```

## Verification

After the migration:

1. Re-query `has_function_privilege('authenticated', 'public.get_business_sensitive(uuid)', 'EXECUTE')` — expect `true` for all listed functions.
2. Reload the dashboard: the Compliance card should show TIN as **`1031640657` — Configured** (green), and the score should jump from 75% → 90%+.
3. Network tab: previously-403 requests to `get_dashboard_stats` / `get_due_date_stats` / `get_business_sensitive` should return `200`.

No frontend files change.