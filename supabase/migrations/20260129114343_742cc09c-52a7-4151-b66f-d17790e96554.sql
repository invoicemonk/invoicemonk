-- Add RLS policy to allow platform admins to view all subscriptions
CREATE POLICY "Platform admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));