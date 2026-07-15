
-- 1. Replace business-logos storage policies with membership-based checks
DROP POLICY IF EXISTS "Users can upload their business logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their business logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their business logos" ON storage.objects;

CREATE POLICY "Business members can upload business logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-logos'
    AND auth.uid() IS NOT NULL
    AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Business members can update business logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND auth.uid() IS NOT NULL
    AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Business members can delete business logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND auth.uid() IS NOT NULL
    AND public.is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 2. Migrate existing objects from `<uid>/<bid>/logo.ext` to `<bid>/logo.ext`
DO $$
DECLARE
  obj record;
  new_name text;
  parts text[];
BEGIN
  FOR obj IN
    SELECT id, name FROM storage.objects
    WHERE bucket_id = 'business-logos'
      AND array_length(storage.foldername(name), 1) >= 2
  LOOP
    parts := storage.foldername(obj.name);
    -- new_name = second folder + '/' + filename
    new_name := parts[2] || '/' || regexp_replace(obj.name, '^[^/]+/[^/]+/', '');
    -- Skip if already exists at target
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='business-logos' AND name = new_name) THEN
      UPDATE storage.objects SET name = new_name WHERE id = obj.id;
    END IF;
  END LOOP;
END $$;

-- 3. Refresh businesses.logo_url to point to the new paths
UPDATE public.businesses b
SET logo_url = regexp_replace(
  logo_url,
  '(/storage/v1/object/public/business-logos/)[^/]+/([^/]+/)',
  '\1\2'
)
WHERE logo_url LIKE '%/storage/v1/object/public/business-logos/%'
  AND logo_url ~ '/storage/v1/object/public/business-logos/[^/]+/[^/]+/';
