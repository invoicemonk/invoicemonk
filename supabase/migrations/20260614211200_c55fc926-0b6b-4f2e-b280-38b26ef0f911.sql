-- Lock down sync_subscription_runs: only service_role writes; deny all
-- INSERT/UPDATE/DELETE for authenticated users. SELECT for admins stays.
CREATE POLICY "Deny inserts by authenticated"
  ON public.sync_subscription_runs
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny updates by authenticated"
  ON public.sync_subscription_runs
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny deletes by authenticated"
  ON public.sync_subscription_runs
  FOR DELETE TO authenticated
  USING (false);

-- Lock down verification_access_logs: only service_role writes; deny
-- INSERT for authenticated/anon. SELECT for admins stays.
CREATE POLICY "Deny inserts by authenticated"
  ON public.verification_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny updates by authenticated"
  ON public.verification_access_logs
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny deletes by authenticated"
  ON public.verification_access_logs
  FOR DELETE TO authenticated
  USING (false);