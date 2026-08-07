CREATE POLICY "Business members can read business logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'business-logos'
  AND auth.uid() IS NOT NULL
  AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);