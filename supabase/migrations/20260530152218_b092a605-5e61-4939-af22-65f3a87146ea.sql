
-- Status enum
CREATE TYPE public.expense_inbox_status AS ENUM ('pending', 'scanning', 'failed', 'approved', 'rejected');

-- Table
CREATE TABLE public.expense_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status public.expense_inbox_status NOT NULL DEFAULT 'pending',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  extracted_data jsonb,
  confidence numeric(3,2),
  handwriting_detected boolean NOT NULL DEFAULT false,
  scan_error text,
  approved_expense_id uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_inbox_business_status ON public.expense_inbox_items(business_id, status, created_at DESC);
CREATE INDEX idx_expense_inbox_user ON public.expense_inbox_items(user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_inbox_items TO authenticated;
GRANT ALL ON public.expense_inbox_items TO service_role;

-- RLS
ALTER TABLE public.expense_inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view inbox items"
  ON public.expense_inbox_items FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can create inbox items"
  ON public.expense_inbox_items FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Business members can update inbox items"
  ON public.expense_inbox_items FOR UPDATE
  USING (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can delete inbox items"
  ON public.expense_inbox_items FOR DELETE
  USING (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage inbox items"
  ON public.expense_inbox_items FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- updated_at trigger
CREATE TRIGGER set_expense_inbox_items_updated_at
  BEFORE UPDATE ON public.expense_inbox_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-inbox',
  'expense-inbox',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: files live under {business_id}/{filename}
CREATE POLICY "Business members can read inbox files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'expense-inbox'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Business members can upload inbox files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'expense-inbox'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Business members can delete inbox files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'expense-inbox'
    AND auth.uid() IS NOT NULL
    AND is_business_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
