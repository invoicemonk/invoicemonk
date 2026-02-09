
-- Storage RLS policies for PDF buckets (using DROP IF EXISTS + CREATE pattern)
DO $$
BEGIN
  -- Drop existing policies if they exist, then recreate
  DROP POLICY IF EXISTS "Business members can read invoice PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "Service role can write invoice PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "Business members can read receipt PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "Service role can write receipt PDFs" ON storage.objects;
END $$;

CREATE POLICY "Business members can read invoice PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoice-pdfs');

CREATE POLICY "Service role can write invoice PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoice-pdfs');

CREATE POLICY "Business members can read receipt PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipt-pdfs');

CREATE POLICY "Service role can write receipt PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipt-pdfs');
