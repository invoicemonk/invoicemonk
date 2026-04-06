CREATE OR REPLACE FUNCTION public.check_team_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier subscription_tier;
  _limit_value INTEGER;
  _current_count INTEGER;
BEGIN
  -- Owner should never be blocked by team limits
  IF NEW.role = 'owner' THEN
    RETURN NEW;
  END IF;

  -- Get tier from business subscription
  SELECT s.tier INTO _tier
  FROM subscriptions s
  WHERE s.business_id = NEW.business_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;
  
  IF _tier IS NULL THEN 
    _tier := 'starter'; 
  END IF;
  
  -- Get limit from tier_limits (single source of truth)
  SELECT limit_value INTO _limit_value
  FROM tier_limits
  WHERE tier = _tier AND feature = 'team_members_limit';
  
  -- If limit is 0, NO team access at all
  IF _limit_value = 0 THEN
    RAISE EXCEPTION 'Team access is not available on your current plan. Please upgrade to Professional or Business to add team members.';
  END IF;
  
  -- If limit is NULL, unlimited
  IF _limit_value IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check current count (exclude the owner)
  SELECT COUNT(*) INTO _current_count
  FROM business_members
  WHERE business_id = NEW.business_id;
  
  IF _current_count >= _limit_value THEN
    RAISE EXCEPTION 'Team member limit reached (% members). Please upgrade to add more team members.', _limit_value;
  END IF;
  
  RETURN NEW;
END;
$$;