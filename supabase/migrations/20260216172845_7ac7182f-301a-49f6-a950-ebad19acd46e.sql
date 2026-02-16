
-- Add has_selected_plan flag to profiles
ALTER TABLE profiles ADD COLUMN has_selected_plan BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing users who already have subscriptions
UPDATE profiles SET has_selected_plan = true
WHERE id IN (SELECT DISTINCT user_id FROM subscriptions WHERE user_id IS NOT NULL);
