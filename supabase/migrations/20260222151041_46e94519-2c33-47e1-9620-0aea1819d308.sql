-- Fix invoice-pdfs storage policy: restrict to business members only
DROP POLICY IF EXISTS "Business members can read invoice PDFs" ON storage.objects;
CREATE POLICY "Business members can read invoice PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-pdfs' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.business_members bm ON i.business_id = bm.business_id
      WHERE bm.user_id = auth.uid()
      AND i.id::text = (storage.foldername(name))[1]
    )
  );

-- Fix receipt-pdfs storage policy: restrict to business members only
DROP POLICY IF EXISTS "Business members can read receipt PDFs" ON storage.objects;
CREATE POLICY "Business members can read receipt PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipt-pdfs' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.receipts r
      JOIN public.business_members bm ON r.business_id = bm.business_id
      WHERE bm.user_id = auth.uid()
      AND r.id::text = (storage.foldername(name))[1]
    )
  );
