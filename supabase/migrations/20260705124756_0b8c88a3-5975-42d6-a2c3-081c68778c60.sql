DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (actor_id IS NULL OR actor_id = auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid() OR is_business_member(auth.uid(), business_id))
  AND (business_id IS NULL OR is_business_member(auth.uid(), business_id) OR has_role(auth.uid(), 'platform_admin'::app_role))
);