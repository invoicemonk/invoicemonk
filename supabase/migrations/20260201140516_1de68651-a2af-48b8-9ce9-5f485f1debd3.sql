-- Drop the existing check_tier_limit function to allow recreation with different parameter names
DROP FUNCTION IF EXISTS public.check_tier_limit(uuid, text);

-- Create business-level check_tier_limit function
CREATE OR REPLACE FUNCTION public.check_tier_limit_business(_business_id uuid, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _subscription RECORD;
  _limit RECORD;
  _current_count INTEGER;
  _tier subscription_tier;
BEGIN
  -- Get business's current subscription (default to starter if none)
  SELECT s.tier INTO _tier
  FROM subscriptions s
  WHERE s.business_id = _business_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Default to starter if no active subscription
  IF _tier IS NULL THEN
    _tier := 'starter'::subscription_tier;
  END IF;
  
  -- Get limit for this tier + feature
  SELECT * INTO _limit
  FROM tier_limits
  WHERE tier = _tier
    AND feature = _feature;
  
  -- No limit defined = allowed
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'reason', 'no_limit_defined'
    );
  END IF;
  
  -- Boolean limits
  IF _limit.limit_type = 'boolean' THEN
    RETURN jsonb_build_object(
      'allowed', _limit.limit_value = 1,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'boolean',
      'reason', CASE WHEN _limit.limit_value = 1 THEN 'allowed' ELSE 'feature_disabled' END
    );
  END IF;
  
  -- Unlimited
  IF _limit.limit_type = 'unlimited' OR _limit.limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'unlimited',
      'reason', 'unlimited'
    );
  END IF;
  
  -- Count-based limits (invoices_per_month)
  IF _feature = 'invoices_per_month' THEN
    SELECT COUNT(*) INTO _current_count
    FROM invoices
    WHERE business_id = _business_id
      AND status != 'draft'
      AND issued_at >= date_trunc('month', CURRENT_DATE)
      AND issued_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
    
    RETURN jsonb_build_object(
      'allowed', _current_count < _limit.limit_value,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'count',
      'current_count', _current_count,
      'limit_value', _limit.limit_value,
      'remaining', GREATEST(0, _limit.limit_value - _current_count),
      'reason', CASE WHEN _current_count < _limit.limit_value THEN 'within_limit' ELSE 'limit_reached' END
    );
  END IF;
  
  -- team_members count
  IF _feature = 'team_members' THEN
    SELECT COUNT(*) INTO _current_count
    FROM business_members bm
    WHERE bm.business_id = _business_id;
    
    RETURN jsonb_build_object(
      'allowed', _current_count < _limit.limit_value,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'count',
      'current_count', _current_count,
      'limit_value', _limit.limit_value,
      'remaining', GREATEST(0, _limit.limit_value - _current_count),
      'reason', CASE WHEN _current_count < _limit.limit_value THEN 'within_limit' ELSE 'limit_reached' END
    );
  END IF;
  
  -- Default: allowed
  RETURN jsonb_build_object(
    'allowed', true,
    'tier', _tier,
    'feature', _feature,
    'reason', 'default_allowed'
  );
END;
$$;

-- Recreate user-level check_tier_limit that delegates to business function
CREATE OR REPLACE FUNCTION public.check_tier_limit(_user_id uuid, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _default_business_id uuid;
BEGIN
  -- Find user's default business
  SELECT b.id INTO _default_business_id
  FROM businesses b
  JOIN business_members bm ON bm.business_id = b.id
  WHERE bm.user_id = _user_id
    AND b.is_default = true
  ORDER BY b.created_at ASC
  LIMIT 1;
  
  -- If no default business found, try to find any business
  IF _default_business_id IS NULL THEN
    SELECT b.id INTO _default_business_id
    FROM businesses b
    JOIN business_members bm ON bm.business_id = b.id
    WHERE bm.user_id = _user_id
    ORDER BY b.created_at ASC
    LIMIT 1;
  END IF;
  
  -- If still no business, return starter tier limits
  IF _default_business_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', 'starter',
      'feature', _feature,
      'reason', 'no_business_found'
    );
  END IF;
  
  -- Delegate to business-level function
  RETURN check_tier_limit_business(_default_business_id, _feature);
END;
$$;