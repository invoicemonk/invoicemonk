-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a more restrictive insert policy
-- Only allow inserts where the user_id matches authenticated user (for self-notifications)
-- Service role bypasses RLS entirely, so edge functions will still work
CREATE POLICY "Users can create their own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);