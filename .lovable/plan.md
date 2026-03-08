

# Fix: Weekly Revenue Summary (Campaign F) Not Being Sent

## Root Cause

The `process-lifecycle-campaigns` edge function has **never been invoked** — there are zero logs for it. The function exists and contains all campaign logic (A through I, including the weekly revenue summary in Campaign F), but **no cron job was set up** to trigger it. The only cron job in the project is for `cleanup-expired-records`.

## Solution

Create a database migration that schedules a cron job to invoke `process-lifecycle-campaigns` daily. Running it daily is appropriate because:
- Campaign F (weekly summary) has its own 6-day cooldown check (`last_weekly_summary_email_at`)
- Other campaigns (A-E, G-I) have their own deduplication/cooldown logic
- The function already has a 20-second execution guard

### Migration SQL

Schedule a daily cron job at **8:00 AM UTC** (a reasonable time for business email delivery):

```sql
SELECT cron.schedule(
  'daily-lifecycle-campaigns',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/process-lifecycle-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon_key>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Additional Fix: JWT Verification

The function currently has `verify_jwt = false` in `config.toml`, so the Authorization header isn't strictly required, but including it follows best practice and matches the existing pattern. We need to confirm the config entry exists — it does per the provided `config.toml`.

### Files to Change

| File | Change |
|------|--------|
| **New migration** | Add `cron.schedule` for daily invocation of `process-lifecycle-campaigns` at 8 AM UTC |

No code changes needed — the edge function logic is already correct. It just was never being called.

