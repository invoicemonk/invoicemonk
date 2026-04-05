-- Delete starter subscriptions for users who never selected a plan
DELETE FROM public.subscriptions
WHERE tier = 'starter'
  AND status = 'active'
  AND business_id IN (
    SELECT bm.business_id
    FROM business_members bm
    JOIN profiles p ON p.id = bm.user_id
    WHERE bm.role = 'owner'
      AND p.has_selected_plan = false
  );

-- Drop the orphaned function (trigger was already removed)
DROP FUNCTION IF EXISTS public.create_default_subscription() CASCADE;