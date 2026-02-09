-- =====================================================
-- TIER SYSTEM OVERHAUL: Single Source of Truth
-- =====================================================

-- Step 1: Clean up existing tier_limits entries to avoid duplicates
DELETE FROM tier_limits WHERE feature IN (
  'currency_accounts_limit', 
  'receipts_limit', 
  'team_members_limit',
  'accounting_enabled',
  'expenses_enabled', 
  'credit_notes_enabled',
  'support_enabled'
);

-- Also clean up conflicting team_members entries
DELETE FROM tier_limits WHERE feature = 'team_members';

-- Step 2: Update invoices_per_month for starter tier to 5
UPDATE tier_limits 
SET limit_value = 5, limit_type = 'count'
WHERE tier = 'starter' AND feature = 'invoices_per_month';

-- Make sure other tiers have unlimited invoices
UPDATE tier_limits 
SET limit_value = NULL, limit_type = 'unlimited'
WHERE tier IN ('starter_paid', 'professional', 'business') AND feature = 'invoices_per_month';

-- Step 3: Insert all new tier limits
-- CURRENCY ACCOUNTS
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'currency_accounts_limit', 'count', 1, 'Number of currency accounts allowed'),
  ('starter_paid', 'currency_accounts_limit', 'count', 3, 'Number of currency accounts allowed'),
  ('professional', 'currency_accounts_limit', 'unlimited', NULL, 'Unlimited currency accounts'),
  ('business', 'currency_accounts_limit', 'unlimited', NULL, 'Unlimited currency accounts');

-- RECEIPTS (monthly)
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'receipts_limit', 'count', 5, 'Monthly receipt limit'),
  ('starter_paid', 'receipts_limit', 'unlimited', NULL, 'Unlimited receipts'),
  ('professional', 'receipts_limit', 'unlimited', NULL, 'Unlimited receipts'),
  ('business', 'receipts_limit', 'unlimited', NULL, 'Unlimited receipts');

-- TEAM MEMBERS (0 means no access)
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'team_members_limit', 'count', 0, 'No team access'),
  ('starter_paid', 'team_members_limit', 'count', 0, 'No team access'),
  ('professional', 'team_members_limit', 'count', 5, 'Up to 5 team members'),
  ('business', 'team_members_limit', 'unlimited', NULL, 'Unlimited team members');

-- ACCOUNTING MODULE (all tiers)
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'accounting_enabled', 'boolean', 1, 'Access to accounting module'),
  ('starter_paid', 'accounting_enabled', 'boolean', 1, 'Access to accounting module'),
  ('professional', 'accounting_enabled', 'boolean', 1, 'Access to accounting module'),
  ('business', 'accounting_enabled', 'boolean', 1, 'Access to accounting module');

-- EXPENSES (all tiers)
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'expenses_enabled', 'boolean', 1, 'Access to expense tracking'),
  ('starter_paid', 'expenses_enabled', 'boolean', 1, 'Access to expense tracking'),
  ('professional', 'expenses_enabled', 'boolean', 1, 'Access to expense tracking'),
  ('business', 'expenses_enabled', 'boolean', 1, 'Access to expense tracking');

-- CREDIT NOTES (all tiers)
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'credit_notes_enabled', 'boolean', 1, 'Access to credit notes'),
  ('starter_paid', 'credit_notes_enabled', 'boolean', 1, 'Access to credit notes'),
  ('professional', 'credit_notes_enabled', 'boolean', 1, 'Access to credit notes'),
  ('business', 'credit_notes_enabled', 'boolean', 1, 'Access to credit notes');

-- SUPPORT (all tiers - universal)
INSERT INTO tier_limits (tier, feature, limit_type, limit_value, description) VALUES
  ('starter', 'support_enabled', 'boolean', 1, 'Access to in-app support'),
  ('starter_paid', 'support_enabled', 'boolean', 1, 'Access to in-app support'),
  ('professional', 'support_enabled', 'boolean', 1, 'Access to in-app support'),
  ('business', 'support_enabled', 'boolean', 1, 'Access to in-app support');

-- =====================================================
-- Step 4: Update check_currency_account_limit function
-- Now uses tier_limits table as single source of truth
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_currency_account_limit(_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_tier subscription_tier;
  account_count INTEGER;
  limit_record RECORD;
BEGIN
  -- Get business tier
  SELECT tier INTO current_tier
  FROM subscriptions
  WHERE business_id = _business_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  
  IF current_tier IS NULL THEN
    current_tier := 'starter';
  END IF;
  
  -- Get limit from tier_limits table (single source of truth)
  SELECT * INTO limit_record
  FROM tier_limits
  WHERE tier = current_tier AND feature = 'currency_accounts_limit';
  
  -- Count current accounts
  SELECT COUNT(*) INTO account_count
  FROM currency_accounts
  WHERE business_id = _business_id;
  
  -- Unlimited if limit_value is NULL or limit_type is 'unlimited'
  IF NOT FOUND OR limit_record.limit_value IS NULL OR limit_record.limit_type = 'unlimited' THEN
    RETURN jsonb_build_object(
      'tier', current_tier,
      'current_count', account_count,
      'limit', NULL,
      'limit_type', 'unlimited',
      'allowed', true
    );
  END IF;
  
  RETURN jsonb_build_object(
    'tier', current_tier,
    'current_count', account_count,
    'limit', limit_record.limit_value,
    'limit_type', 'count',
    'allowed', account_count < limit_record.limit_value,
    'remaining', GREATEST(0, limit_record.limit_value - account_count)
  );
END;
$$;

-- =====================================================
-- Step 5: Update check_team_member_limit function
-- team_members_limit = 0 means NO team access at all
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_team_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tier subscription_tier;
  _limit_value INTEGER;
  _current_count INTEGER;
BEGIN
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
  
  -- Check current count (exclude the owner who is auto-added)
  SELECT COUNT(*) INTO _current_count
  FROM business_members
  WHERE business_id = NEW.business_id;
  
  IF _current_count >= _limit_value THEN
    RAISE EXCEPTION 'Team member limit reached (% members). Please upgrade to add more team members.', _limit_value;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- Step 6: Create receipt limit enforcement trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_receipt_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tier subscription_tier;
  _limit_value INTEGER;
  _limit_type TEXT;
  _current_count INTEGER;
BEGIN
  -- Get tier from business subscription
  SELECT s.tier INTO _tier
  FROM subscriptions s
  WHERE s.business_id = NEW.business_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;
  
  IF _tier IS NULL THEN 
    _tier := 'starter'; 
  END IF;
  
  -- Get limit from tier_limits
  SELECT limit_value, limit_type INTO _limit_value, _limit_type
  FROM tier_limits
  WHERE tier = _tier AND feature = 'receipts_limit';
  
  -- NULL or unlimited = no limit
  IF _limit_value IS NULL OR _limit_type = 'unlimited' THEN 
    RETURN NEW; 
  END IF;
  
  -- Count receipts this month
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
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS check_receipt_limit_trigger ON receipts;
CREATE TRIGGER check_receipt_limit_trigger
  BEFORE INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION check_receipt_limit();

-- =====================================================
-- Step 7: Update check_tier_limit_business function
-- Unified function that handles all feature types
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_tier_limit_business(_business_id uuid, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tier subscription_tier;
  _limit RECORD;
  _current_count INTEGER;
BEGIN
  -- Get tier
  SELECT s.tier INTO _tier
  FROM subscriptions s
  WHERE s.business_id = _business_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;
  
  IF _tier IS NULL THEN 
    _tier := 'starter'; 
  END IF;
  
  -- Get limit from tier_limits (single source of truth)
  SELECT * INTO _limit
  FROM tier_limits
  WHERE tier = _tier AND feature = _feature;
  
  -- No limit defined = allowed by default
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
      'limit_value', _limit.limit_value
    );
  END IF;
  
  -- Unlimited
  IF _limit.limit_type = 'unlimited' OR _limit.limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true, 
      'tier', _tier, 
      'feature', _feature, 
      'limit_type', 'unlimited'
    );
  END IF;
  
  -- Count-based: calculate current count based on feature
  CASE _feature
    WHEN 'invoices_per_month' THEN
      SELECT COUNT(*) INTO _current_count
      FROM invoices
      WHERE business_id = _business_id 
        AND status != 'draft'
        AND issued_at >= date_trunc('month', CURRENT_DATE)
        AND issued_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
    WHEN 'receipts_limit' THEN
      SELECT COUNT(*) INTO _current_count
      FROM receipts
      WHERE business_id = _business_id
        AND issued_at >= date_trunc('month', CURRENT_DATE)
        AND issued_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
    WHEN 'team_members_limit' THEN
      SELECT COUNT(*) INTO _current_count
      FROM business_members 
      WHERE business_id = _business_id;
    WHEN 'currency_accounts_limit' THEN
      SELECT COUNT(*) INTO _current_count
      FROM currency_accounts 
      WHERE business_id = _business_id;
    ELSE
      _current_count := 0;
  END CASE;
  
  RETURN jsonb_build_object(
    'allowed', _current_count < _limit.limit_value,
    'tier', _tier,
    'feature', _feature,
    'limit_type', 'count',
    'current_count', _current_count,
    'limit_value', _limit.limit_value,
    'remaining', GREATEST(0, _limit.limit_value - _current_count)
  );
END;
$$;