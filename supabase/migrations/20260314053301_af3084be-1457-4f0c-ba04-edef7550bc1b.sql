
-- Backfill user_id on existing subscriptions from business owner
UPDATE public.subscriptions s
SET user_id = bm.user_id
FROM public.business_members bm
WHERE s.business_id = bm.business_id
  AND bm.role = 'owner'
  AND s.user_id IS NULL;
