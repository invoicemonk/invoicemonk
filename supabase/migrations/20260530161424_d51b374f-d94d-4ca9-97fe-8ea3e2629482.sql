-- Phase D: accounting-reports storage bucket for generated tax reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accounting-reports',
  'accounting-reports',
  false,
  2097152, -- 2 MB
  ARRAY['text/html','application/pdf','text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: files live under {business_id}/{filename}
CREATE POLICY "Business members can read accounting reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'accounting-reports'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Business members can delete accounting reports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'accounting-reports'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );