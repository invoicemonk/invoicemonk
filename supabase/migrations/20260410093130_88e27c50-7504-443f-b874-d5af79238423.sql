-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule send-renewal-reminders at 6 AM UTC daily
SELECT cron.schedule(
  'send-renewal-reminders-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/send-renewal-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);