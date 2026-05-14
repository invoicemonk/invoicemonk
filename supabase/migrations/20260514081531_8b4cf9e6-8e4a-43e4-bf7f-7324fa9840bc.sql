-- 1. Create sensitive data sibling table
CREATE TABLE public.business_sensitive_data (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  tax_id text,
  government_id_type text,
  government_id_value text,
  vat_registration_number text,
  cac_number text,
  stripe_connect_account_id text,
  paystack_subaccount_code text,
  flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. updated_at trigger
CREATE TRIGGER business_sensitive_data_set_updated_at
  BEFORE UPDATE ON public.business_sensitive_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Backfill from businesses (one row per existing business)
INSERT INTO public.business_sensitive_data (
  business_id, tax_id, government_id_type, government_id_value,
  vat_registration_number, cac_number,
  stripe_connect_account_id, paystack_subaccount_code, flag_reason
)
SELECT id, tax_id, government_id_type, government_id_value,
       vat_registration_number, cac_number,
       stripe_connect_account_id, paystack_subaccount_code, flag_reason
FROM public.businesses;

-- 4. Enable RLS
ALTER TABLE public.business_sensitive_data ENABLE ROW LEVEL SECURITY;

-- 5. Policies: only owner/admin of the business (or platform admins) can access
CREATE POLICY "Owners and admins can view sensitive data"
  ON public.business_sensitive_data
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'platform_admin'::app_role)
      OR has_business_role(auth.uid(), business_id, 'owner'::business_role)
      OR has_business_role(auth.uid(), business_id, 'admin'::business_role)
    )
  );

CREATE POLICY "Owners and admins can insert sensitive data"
  ON public.business_sensitive_data
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_business_role(auth.uid(), business_id, 'owner'::business_role)
      OR has_business_role(auth.uid(), business_id, 'admin'::business_role)
    )
  );

CREATE POLICY "Owners and admins can update sensitive data"
  ON public.business_sensitive_data
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      has_business_role(auth.uid(), business_id, 'owner'::business_role)
      OR has_business_role(auth.uid(), business_id, 'admin'::business_role)
    )
  );

CREATE POLICY "Platform admins can manage sensitive data"
  ON public.business_sensitive_data
  FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- 6. Helper RPC for owner/admin checks (callable by frontend; respects RLS through the
--    underlying table — service role bypasses RLS so this also works in edge functions).
CREATE OR REPLACE FUNCTION public.get_business_sensitive(_business_id uuid)
RETURNS public.business_sensitive_data
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.business_sensitive_data;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    has_role(auth.uid(), 'platform_admin'::app_role)
    OR has_business_role(auth.uid(), _business_id, 'owner'::business_role)
    OR has_business_role(auth.uid(), _business_id, 'admin'::business_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO result
  FROM public.business_sensitive_data
  WHERE business_id = _business_id;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_business_sensitive(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_business_sensitive(uuid) TO authenticated;

-- 7. Drop sensitive columns from businesses
ALTER TABLE public.businesses
  DROP COLUMN tax_id,
  DROP COLUMN government_id_type,
  DROP COLUMN government_id_value,
  DROP COLUMN vat_registration_number,
  DROP COLUMN cac_number,
  DROP COLUMN stripe_connect_account_id,
  DROP COLUMN paystack_subaccount_code,
  DROP COLUMN flag_reason;