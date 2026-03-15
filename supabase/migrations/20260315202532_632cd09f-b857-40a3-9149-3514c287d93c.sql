
-- Update check_tier_limit_business to validate subscription expiration with 3-day grace period
CREATE OR REPLACE FUNCTION public.check_tier_limit_business(_business_id uuid, _feature text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tier subscription_tier;
  _limit_value integer;
  _limit_type text;
  _current_count integer;
BEGIN
  -- Platform admins bypass all limits
  IF has_role(auth.uid(), 'platform_admin') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', 'business',
      'feature', _feature,
      'limit_type', 'unlimited',
      'unlimited', true
    );
  END IF;

  -- Get the tier for this business (with expiration + 3-day grace period check)
  SELECT COALESCE(s.tier, 'starter')
  INTO _tier
  FROM businesses b
  LEFT JOIN subscriptions s ON s.business_id = b.id 
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end + interval '3 days' >= now())
  WHERE b.id = _business_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _tier IS NULL THEN
    _tier := 'starter';
  END IF;

  -- Get the limit for this feature and tier
  SELECT tl.limit_value, tl.limit_type
  INTO _limit_value, _limit_type
  FROM tier_limits tl
  WHERE tl.tier = _tier AND tl.feature = _feature;

  -- If no limit defined, allow
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'undefined'
    );
  END IF;

  -- Boolean limits
  IF _limit_type = 'boolean' THEN
    RETURN jsonb_build_object(
      'allowed', COALESCE(_limit_value, 0) = 1,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'boolean',
      'limit_value', COALESCE(_limit_value, 0)
    );
  END IF;

  -- Unlimited limits
  IF _limit_type = 'unlimited' OR _limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'unlimited'
    );
  END IF;

  -- Count-based limits
  IF _feature = 'invoices_per_month' THEN
    SELECT COUNT(*) INTO _current_count
    FROM invoices i
    WHERE i.business_id = _business_id
      AND i.status != 'draft'
      AND i.issued_at >= date_trunc('month', CURRENT_TIMESTAMP);
  ELSIF _feature = 'team_members_limit' THEN
    SELECT COUNT(*) INTO _current_count
    FROM business_members bm
    WHERE bm.business_id = _business_id;
  ELSIF _feature = 'currency_accounts_limit' THEN
    SELECT COUNT(*) INTO _current_count
    FROM currency_accounts ca
    WHERE ca.business_id = _business_id;
  ELSE
    _current_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', _current_count < _limit_value,
    'tier', _tier,
    'feature', _feature,
    'limit_type', 'count',
    'current_count', _current_count,
    'limit_value', _limit_value,
    'remaining', GREATEST(0, _limit_value - _current_count)
  );
END;
$function$;

-- Also update check_currency_account_limit with same expiration check
CREATE OR REPLACE FUNCTION public.check_currency_account_limit(_business_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tier subscription_tier;
  _limit_value integer;
  _limit_type text;
  _current_count integer;
BEGIN
  -- Platform admins bypass all limits
  IF has_role(auth.uid(), 'platform_admin') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', 'business',
      'current_count', 0,
      'limit', null,
      'limit_type', 'unlimited'
    );
  END IF;

  -- Get the tier (with expiration + 3-day grace period)
  SELECT COALESCE(s.tier, 'starter')
  INTO _tier
  FROM businesses b
  LEFT JOIN subscriptions s ON s.business_id = b.id 
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end + interval '3 days' >= now())
  WHERE b.id = _business_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _tier IS NULL THEN
    _tier := 'starter';
  END IF;

  SELECT tl.limit_value, tl.limit_type
  INTO _limit_value, _limit_type
  FROM tier_limits tl
  WHERE tl.tier = _tier AND tl.feature = 'currency_accounts_limit';

  SELECT COUNT(*) INTO _current_count
  FROM currency_accounts ca
  WHERE ca.business_id = _business_id;

  IF _limit_type = 'unlimited' OR _limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'current_count', _current_count,
      'limit', null,
      'limit_type', 'unlimited'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', _current_count < _limit_value,
    'tier', _tier,
    'current_count', _current_count,
    'limit', _limit_value,
    'limit_type', 'count'
  );
END;
$function$;

-- Also update check_receipt_limit trigger with same expiration check
CREATE OR REPLACE FUNCTION public.check_receipt_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tier subscription_tier;
  _limit_value INTEGER;
  _limit_type TEXT;
  _current_count INTEGER;
BEGIN
  -- Get tier from business subscription (with expiration + 3-day grace)
  SELECT s.tier INTO _tier
  FROM subscriptions s
  WHERE s.business_id = NEW.business_id 
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end + interval '3 days' >= now())
  ORDER BY s.created_at DESC LIMIT 1;
  
  IF _tier IS NULL THEN 
    _tier := 'starter'; 
  END IF;
  
  SELECT limit_value, limit_type INTO _limit_value, _limit_type
  FROM tier_limits
  WHERE tier = _tier AND feature = 'receipts_limit';
  
  IF _limit_value IS NULL OR _limit_type = 'unlimited' THEN 
    RETURN NEW; 
  END IF;
  
  SELECT COUNT(*) INTO _current_count
  FROM receipts
  WHERE business_id = NEW.business_id
    AND issued_at >= date_trunc('month', CURRENT_DATE)
    AND issued_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
  
  IF _current_count >= _limit_value THEN
    RAISE EXCEPTION 'Monthly receipt limit reached (% receipts). Please upgrade your plan to issue more receipts.', _limit_value;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update has_tier to also check expiration
CREATE OR REPLACE FUNCTION public.has_tier(_user_id uuid, _required_tier subscription_tier)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_tier subscription_tier;
  _tier_order INTEGER;
  _required_order INTEGER;
BEGIN
  -- Get user's current tier (with expiration + 3-day grace period)
  SELECT s.tier INTO _user_tier
  FROM subscriptions s
  LEFT JOIN business_members bm ON bm.business_id = s.business_id
  WHERE (s.user_id = _user_id OR bm.user_id = _user_id)
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end + interval '3 days' >= now())
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  IF _user_tier IS NULL THEN
    _user_tier := 'starter';
  END IF;
  
  _tier_order := CASE _user_tier
    WHEN 'starter' THEN 1
    WHEN 'starter_paid' THEN 1
    WHEN 'professional' THEN 2
    WHEN 'business' THEN 3
    ELSE 0
  END;
  
  _required_order := CASE _required_tier
    WHEN 'starter' THEN 1
    WHEN 'starter_paid' THEN 1
    WHEN 'professional' THEN 2
    WHEN 'business' THEN 3
    ELSE 0
  END;
  
  RETURN _tier_order >= _required_order;
END;
$function$;
