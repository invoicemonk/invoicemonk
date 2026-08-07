DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;

CREATE POLICY "Authenticated users can create businesses"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);