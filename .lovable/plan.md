

# Fix: "Database error saving new user" on Signup

## Root Cause

The signup flow triggers this chain:

1. User signs up → Supabase inserts into `auth.users`
2. Trigger `on_auth_user_created` → `handle_new_user()` creates profile + role (succeeds)
3. Trigger `on_auth_user_created_default_business` → `create_default_business()` creates a business and inserts the owner into `business_members`
4. The `business_members` INSERT fires the `enforce_team_member_limit` trigger → `check_team_member_limit()`
5. Since the new business has no subscription, the tier defaults to `'starter'`, which has `team_members_limit = 1`
6. The function counts existing members (`COUNT(*) >= 1` is true because the owner row is being inserted), so it raises an exception
7. The entire transaction rolls back — no user, no profile, no business is created

**The team member limit check is incorrectly blocking the business owner from being added as the first member of their own business.**

## Fix

Modify `check_team_member_limit` to skip validation when the member being added has the `'owner'` role. The owner is the person who created the business and should never be blocked by team limits.

## Migration SQL

```sql
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
```

## Files Changed

| File | Change |
|---|---|
| New migration | `CREATE OR REPLACE FUNCTION check_team_member_limit` — add early return when `NEW.role = 'owner'` |

No frontend changes needed. This is a database-only fix.

