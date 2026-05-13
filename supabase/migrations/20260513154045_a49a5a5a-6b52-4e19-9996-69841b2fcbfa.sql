CREATE TABLE public.sync_subscription_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  triggered_by text NOT NULL DEFAULT 'cron',
  triggered_by_user uuid,
  synced int NOT NULL DEFAULT 0,
  downgraded int NOT NULL DEFAULT 0,
  renewed int NOT NULL DEFAULT 0,
  repointed int NOT NULL DEFAULT 0,
  errors jsonb,
  duration_ms int
);

ALTER TABLE public.sync_subscription_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view sync runs"
  ON public.sync_subscription_runs FOR SELECT
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'platform_admin'::app_role));

CREATE INDEX idx_sync_subscription_runs_ran_at ON public.sync_subscription_runs (ran_at DESC);