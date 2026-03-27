-- Stagger daily cron jobs: 8:00 / 8:05 / 8:10 UTC
-- to reduce concurrent DB load and improve log clarity

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'send-due-date-reminders-daily'),
  '5 8 * * *'
);

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'daily-lifecycle-campaigns'),
  '10 8 * * *'
);