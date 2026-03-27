-- Fix 1: Add timeout_milliseconds to overdue invoices cron job
SELECT cron.alter_job(
  2,
  command := $$SELECT net.http_post(
    url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/check-overdue-invoices',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;$$
);

-- Fix 2: Add timeout_milliseconds to due-date reminders cron job
SELECT cron.alter_job(
  3,
  command := $$SELECT net.http_post(
    url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/send-due-date-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;$$
);

-- Fix 3: Sync email_verified flag for users who have confirmed their email
UPDATE user_activity_state uas
SET email_verified = true
FROM auth.users au
WHERE uas.user_id = au.id
  AND au.email_confirmed_at IS NOT NULL
  AND uas.email_verified = false;