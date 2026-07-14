
-- ============================================
-- push_tokens: device push notification tokens
-- ============================================
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  device_id TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE INDEX idx_push_tokens_user ON public.push_tokens(user_id);

-- ============================================
-- scan_jobs: AI-powered receipt/invoice scans
-- ============================================
CREATE TYPE public.scan_source AS ENUM ('receipt', 'invoice');
CREATE TYPE public.scan_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TABLE public.scan_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source public.scan_source NOT NULL,
  storage_path TEXT NOT NULL,
  status public.scan_status NOT NULL DEFAULT 'pending',
  extracted_json JSONB,
  confidence NUMERIC(5,2),
  error TEXT,
  linked_expense_inbox_id UUID,
  linked_invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_jobs TO authenticated;
GRANT ALL ON public.scan_jobs TO service_role;

ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members view scan jobs"
  ON public.scan_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members insert scan jobs"
  ON public.scan_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Business members update scan jobs"
  ON public.scan_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_business_member(auth.uid(), business_id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members delete scan jobs"
  ON public.scan_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_business_member(auth.uid(), business_id));

CREATE INDEX idx_scan_jobs_business ON public.scan_jobs(business_id, created_at DESC);
CREATE INDEX idx_scan_jobs_user ON public.scan_jobs(user_id, created_at DESC);
CREATE INDEX idx_scan_jobs_status ON public.scan_jobs(status) WHERE status IN ('pending', 'processing');

-- updated_at triggers
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER scan_jobs_updated_at
  BEFORE UPDATE ON public.scan_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Storage policies for receipt-scans bucket
-- Path convention: {businessId}/{uuid}.{ext}
-- ============================================
CREATE POLICY "Business members read receipt scans"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipt-scans'
    AND auth.uid() IS NOT NULL
    AND public.is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Business members upload receipt scans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipt-scans'
    AND auth.uid() IS NOT NULL
    AND public.is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Business members delete receipt scans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipt-scans'
    AND auth.uid() IS NOT NULL
    AND public.is_business_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
