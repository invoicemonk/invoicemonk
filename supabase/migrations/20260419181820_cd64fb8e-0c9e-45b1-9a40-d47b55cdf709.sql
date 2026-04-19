-- 1. Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB,
  tax_id TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique per business on normalised name
CREATE UNIQUE INDEX vendors_business_name_norm_idx
  ON public.vendors (business_id, lower(trim(name)));

CREATE INDEX vendors_business_id_idx ON public.vendors (business_id);

-- 2. Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (mirror clients)
CREATE POLICY "Business members can view vendors"
  ON public.vendors
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can create vendors"
  ON public.vendors
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can update vendors"
  ON public.vendors
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND is_business_member(auth.uid(), business_id));

CREATE POLICY "Business owners can delete vendors"
  ON public.vendors
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND has_business_role(auth.uid(), business_id, 'owner'::business_role));

CREATE POLICY "Platform admins can manage vendors"
  ON public.vendors
  FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- 4. updated_at trigger
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add vendor_id to expenses (nullable, soft FK)
ALTER TABLE public.expenses
  ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE INDEX expenses_vendor_id_idx ON public.expenses (vendor_id);

-- 6. Backfill: case + whitespace normalised dedupe per business
-- For each (business_id, normalised vendor), pick the most recent original casing.
WITH ranked AS (
  SELECT
    business_id,
    vendor,
    lower(trim(vendor)) AS norm,
    user_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, lower(trim(vendor))
      ORDER BY created_at DESC
    ) AS rn
  FROM public.expenses
  WHERE business_id IS NOT NULL
    AND vendor IS NOT NULL
    AND trim(vendor) <> ''
),
to_insert AS (
  SELECT business_id, vendor AS canonical_name, norm, user_id
  FROM ranked
  WHERE rn = 1
)
INSERT INTO public.vendors (business_id, name, created_by)
SELECT business_id, canonical_name, user_id
FROM to_insert
ON CONFLICT (business_id, lower(trim(name))) DO NOTHING;

-- 7. Link expenses.vendor_id to the matching vendor row
UPDATE public.expenses e
SET vendor_id = v.id
FROM public.vendors v
WHERE e.vendor_id IS NULL
  AND e.business_id IS NOT NULL
  AND e.vendor IS NOT NULL
  AND trim(e.vendor) <> ''
  AND e.business_id = v.business_id
  AND lower(trim(e.vendor)) = lower(trim(v.name));