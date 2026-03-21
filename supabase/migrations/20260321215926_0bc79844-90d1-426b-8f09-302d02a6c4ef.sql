
SELECT cron.schedule(
  'lock-commissions-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/lock-commissions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
