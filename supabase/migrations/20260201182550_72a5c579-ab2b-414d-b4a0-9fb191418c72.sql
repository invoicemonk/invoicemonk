-- Migrate orphaned clients to user's default business
-- The constraint requires: either user_id OR business_id, not both
UPDATE clients c
SET 
  business_id = (
    SELECT b.id FROM businesses b
    JOIN business_members bm ON bm.business_id = b.id
    WHERE bm.user_id = c.user_id
      AND b.is_default = true
    LIMIT 1
  ),
  user_id = NULL
WHERE c.business_id IS NULL
  AND c.user_id IS NOT NULL;