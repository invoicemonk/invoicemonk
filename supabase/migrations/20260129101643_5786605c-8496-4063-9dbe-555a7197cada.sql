-- Remove duplicate trigger that causes constraint violation
-- This trigger duplicates add_business_creator_as_owner_trigger and causes
-- "duplicate key value violates unique constraint 'business_members_user_id_business_id_key'"
DROP TRIGGER IF EXISTS add_business_owner ON public.businesses;