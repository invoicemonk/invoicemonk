-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create the weekly cron job to cleanup expired records
-- Runs every Sunday at 2:00 AM UTC
SELECT cron.schedule(
  'weekly-cleanup-expired-records',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/cleanup-expired-records',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Scheduled-Function', 'true'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);