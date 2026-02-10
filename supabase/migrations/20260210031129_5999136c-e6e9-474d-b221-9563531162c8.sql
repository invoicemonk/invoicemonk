UPDATE tier_limits
SET limit_value = 1
WHERE feature = 'team_members_limit'
  AND tier IN ('starter', 'starter_paid');