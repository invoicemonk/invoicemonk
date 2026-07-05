DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.contact_messages;

CREATE POLICY "Platform admins can read messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));