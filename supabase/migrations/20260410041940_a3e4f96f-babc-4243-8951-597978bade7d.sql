
-- ============================================================
-- 1. Remove anonymous PDF upload policies (service role bypasses RLS)
-- ============================================================
DROP POLICY IF EXISTS "Service role can write invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can write receipt PDFs" ON storage.objects;

-- ============================================================
-- 2. Fix payment-proofs upload policy: require business membership
-- ============================================================
DROP POLICY IF EXISTS "Business members can upload payment proofs" ON storage.objects;
CREATE POLICY "Business members can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- 3. Fix pending-member file reads: require accepted_at IS NOT NULL
-- ============================================================

-- 3a. invoice-pdfs
DROP POLICY IF EXISTS "Business members can read invoice PDFs" ON storage.objects;
CREATE POLICY "Business members can read invoice PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-pdfs'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.business_members bm ON i.business_id = bm.business_id
      WHERE bm.user_id = auth.uid()
        AND bm.accepted_at IS NOT NULL
        AND i.id::text = (storage.foldername(name))[1]
    )
  );

-- 3b. receipt-pdfs
DROP POLICY IF EXISTS "Business members can read receipt PDFs" ON storage.objects;
CREATE POLICY "Business members can read receipt PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipt-pdfs'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.receipts r
      JOIN public.business_members bm ON r.business_id = bm.business_id
      WHERE bm.user_id = auth.uid()
        AND bm.accepted_at IS NOT NULL
        AND r.id::text = (storage.foldername(name))[1]
    )
  );

-- 3c. payment-proofs
DROP POLICY IF EXISTS "Business members can read payment proofs" ON storage.objects;
CREATE POLICY "Business members can read payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.business_members
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND business_id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- 4. Restrict audit log inserts: actor_id must match caller
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

-- ============================================================
-- 5. Realtime channel authorization for notifications
-- ============================================================
-- Add RLS policy so users can only receive realtime events for their own notifications
CREATE POLICY "Users can only listen to own notifications"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = 'realtime:public:notifications:user_id=eq.' || auth.uid()::text
  );
