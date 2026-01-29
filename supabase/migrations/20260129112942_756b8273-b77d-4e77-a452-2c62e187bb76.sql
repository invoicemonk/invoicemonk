-- Add RLS policy to allow platform admins to view all profiles
CREATE POLICY "Platform admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));