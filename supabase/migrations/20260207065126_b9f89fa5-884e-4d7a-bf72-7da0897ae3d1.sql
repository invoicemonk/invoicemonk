
-- Phase 1: Add RETENTION_CLEANUP to audit_event_type enum
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'RETENTION_CLEANUP';

-- Phase 3: Fix has_tier function to include starter_paid
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
  -- Get user's current tier (check business-level first, then user-level)
  SELECT s.tier INTO _user_tier
  FROM subscriptions s
  LEFT JOIN business_members bm ON bm.business_id = s.business_id
  WHERE (s.user_id = _user_id OR bm.user_id = _user_id)
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Default to starter if no subscription
  IF _user_tier IS NULL THEN
    _user_tier := 'starter';
  END IF;
  
  -- Define tier ordering (starter_paid same level as starter)
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

-- Phase 2: Fix tier_limits to match actual behavior (verification portal open to all)
UPDATE public.tier_limits 
SET limit_value = 1, updated_at = now()
WHERE feature = 'verification_portal' 
  AND tier IN ('starter', 'starter_paid');

-- Phase 3: Drop unused SLA columns from subscriptions
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS priority_support;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS sla_response_hours;
