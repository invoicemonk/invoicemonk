-- Fix 1: Prevent admin self-promotion to owner role
DROP POLICY "Business owners/admins can update members" ON public.business_members;

CREATE POLICY "Business owners/admins can update members"
ON public.business_members
FOR UPDATE
USING (
  has_business_role(auth.uid(), business_id, 'owner'::business_role)
  OR has_business_role(auth.uid(), business_id, 'admin'::business_role)
)
WITH CHECK (
  role <> 'owner'::business_role
  OR has_business_role(auth.uid(), business_id, 'owner'::business_role)
);

-- Fix 2: Restrict audit log access for pending invitees
DROP POLICY "Audit logs require professional tier or higher" ON public.audit_logs;

CREATE POLICY "Audit logs require professional tier or higher"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'platform_admin'::app_role)
  OR (
    has_audit_access(auth.uid())
    AND (
      user_id = auth.uid()
      OR is_business_member(auth.uid(), business_id)
    )
  )
);