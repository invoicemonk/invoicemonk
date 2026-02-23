-- Fix: Payment proofs storage SELECT policy - restrict to business members only
-- The file path structure is: {business_id}/{payment_id}/{filename}
-- So (storage.foldername(name))[1] gives us the business_id

DROP POLICY IF EXISTS "Business members can read payment proofs" ON storage.objects;

CREATE POLICY "Business members can read payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE user_id = auth.uid()
      AND business_id::text = (storage.foldername(name))[1]
    )
  );