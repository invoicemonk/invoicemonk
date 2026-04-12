CREATE OR REPLACE FUNCTION public.check_tier_limit_business(_business_id uuid, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier subscription_tier;
  _limit_value integer;
  _limit_type text;
  _current_count integer;
BEGIN
  IF has_role(auth.uid(), 'platform_admin') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', 'business',
      'feature', _feature,
      'limit_type', 'unlimited',
      'unlimited', true
    );
  END IF;

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
  WHERE tl.tier = _tier AND tl.feature = _feature;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'undefined'
    );
  END IF;

  IF _limit_type = 'boolean' THEN
    RETURN jsonb_build_object(
      'allowed', COALESCE(_limit_value, 0) = 1,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'boolean',
      'limit_value', COALESCE(_limit_value, 0)
    );
  END IF;

  IF _limit_type = 'unlimited' OR _limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'unlimited'
    );
  END IF;

  IF _feature = 'invoices_per_month' THEN
    SELECT COUNT(*) INTO _current_count
    FROM invoices i
    WHERE i.business_id = _business_id
      AND i.status NOT IN ('draft', 'voided')
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
$$;