CREATE POLICY "Platform admins can view all memberships"
  ON public.business_members
  FOR SELECT
  TO public
  USING (has_role(auth.uid(), 'platform_admin'::app_role));