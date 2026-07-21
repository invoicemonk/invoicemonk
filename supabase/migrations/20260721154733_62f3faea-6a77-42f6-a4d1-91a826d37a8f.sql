
-- Mobile alignment: RevenueCat columns, export file URL, exports bucket RLS

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id TEXT,
  ADD COLUMN IF NOT EXISTS revenuecat_product_id TEXT,
  ADD COLUMN IF NOT EXISTS store TEXT;

CREATE INDEX IF NOT EXISTS subscriptions_revenuecat_app_user_id_idx
  ON public.subscriptions (revenuecat_app_user_id)
  WHERE revenuecat_app_user_id IS NOT NULL;

ALTER TABLE public.export_manifests
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Storage RLS for the private 'exports' bucket.
-- Path convention: {business_id}/{filename}
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Business members read exports') THEN
    CREATE POLICY "Business members read exports"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'exports'
        AND EXISTS (
          SELECT 1 FROM public.business_members bm
          WHERE bm.user_id = auth.uid()
            AND bm.business_id::text = (storage.foldername(name))[1]
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Service role writes exports') THEN
    CREATE POLICY "Service role writes exports"
      ON storage.objects FOR ALL TO service_role
      USING (bucket_id = 'exports')
      WITH CHECK (bucket_id = 'exports');
  END IF;
END $$;
