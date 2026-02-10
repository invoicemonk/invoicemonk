
-- Create the expense-receipts bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts under their own folder
CREATE POLICY "Users can upload expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own receipts
CREATE POLICY "Users can view own expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own receipts
CREATE POLICY "Users can delete own expense receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
