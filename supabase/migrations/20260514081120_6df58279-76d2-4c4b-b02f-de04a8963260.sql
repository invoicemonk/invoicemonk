DO $$
DECLARE
  v_jobid bigint;
  v_secret text;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'lock-commissions-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  PERFORM cron.schedule(
    'lock-commissions-daily',
    '0 4 * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://skcxogeaerudoadluexz.supabase.co/functions/v1/lock-commissions',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      ) AS request_id;
    $cron$, COALESCE(v_secret, ''))
  );
END $$;