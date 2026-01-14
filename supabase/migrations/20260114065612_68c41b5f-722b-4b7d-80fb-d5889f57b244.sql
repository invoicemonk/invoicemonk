-- Phase 3: Tier-Based Access Control for Audit Logs
-- Starter users should not be able to access audit logs directly
-- Professional and Business tier users can access their own audit logs

-- First, let's create a helper function to check if user has reports/audit access
CREATE OR REPLACE FUNCTION public.has_audit_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM subscriptions s
    WHERE s.user_id = _user_id
      AND s.status = 'active'
      AND s.tier IN ('professional', 'business')
  )
  OR has_role(_user_id, 'platform_admin')
$$;

-- Drop existing audit logs SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Business members can view business audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Starter tier cannot view audit logs" ON public.audit_logs;

-- Create new consolidated policy for audit log access
-- Users can only view if they have Pro/Business tier OR are platform admin
CREATE POLICY "Audit logs require professional tier or higher"
  ON public.audit_logs
  FOR SELECT
  USING (
    -- Platform admins can always see
    has_role(auth.uid(), 'platform_admin')
    OR
    -- Professional/Business users can see their own logs
    (
      has_audit_access(auth.uid())
      AND (
        user_id = auth.uid()
        OR business_id IN (
          SELECT business_id FROM business_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Phase 4: Team Member Limit Enforcement
-- Add a function to check team member limit before insert
CREATE OR REPLACE FUNCTION public.check_team_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _business_owner_id UUID;
  _tier_result JSONB;
  _current_count INTEGER;
  _limit_value INTEGER;
BEGIN
  -- Get business owner
  SELECT created_by INTO _business_owner_id
  FROM businesses
  WHERE id = NEW.business_id;

  -- Check tier limit for team_members
  SELECT check_tier_limit(_business_owner_id, 'team_members') INTO _tier_result;

  -- Parse result
  IF (_tier_result->>'allowed')::BOOLEAN = false THEN
    RAISE EXCEPTION 'Team member limit reached for your subscription tier. Please upgrade to add more team members.';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to enforce team member limits
DROP TRIGGER IF EXISTS enforce_team_member_limit ON public.business_members;
CREATE TRIGGER enforce_team_member_limit
  BEFORE INSERT ON public.business_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_team_member_limit();