
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id text,
  ADD COLUMN IF NOT EXISTS revenuecat_product_id text,
  ADD COLUMN IF NOT EXISTS store text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_revenuecat_app_user
  ON public.subscriptions(revenuecat_app_user_id) WHERE revenuecat_app_user_id IS NOT NULL;

ALTER TABLE public.export_manifests
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_path text;

CREATE POLICY "Business members update verification docs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'verification-documents' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'verification-documents' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Business members delete verification docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'verification-documents' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Business members update payment proofs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Business members delete payment proofs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Business members update inbox files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'expense-inbox' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'expense-inbox' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Business members update receipt scans"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipt-scans' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'receipt-scans' AND auth.uid() IS NOT NULL
         AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Users update own expense receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text))
  WITH CHECK (bucket_id = 'expense-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "Business members read exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND auth.uid() IS NOT NULL
         AND (
           ( (storage.foldername(name))[1] = 'user'
             AND (storage.foldername(name))[2] = auth.uid()::text )
           OR public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
         ));
