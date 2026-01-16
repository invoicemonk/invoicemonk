-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their business logos
CREATE POLICY "Users can upload their business logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own logos
CREATE POLICY "Users can update their business logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own logos
CREATE POLICY "Users can delete their business logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view business logos (public bucket)
CREATE POLICY "Anyone can view business logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-logos');