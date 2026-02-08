-- ==========================================
-- GLOBAL-FIRST REFACTORING: BUSINESS IDENTITY
-- ==========================================

-- Step 1: Add regulator_code column for jurisdiction-specific regulatory linkage
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS regulator_code TEXT NULL;

-- Step 2: Migrate existing nrs_linked to regulator_linked with regulator_code
-- Do this BEFORE updating any constraints
UPDATE public.businesses 
SET 
  regulator_code = 'NGA-NRS',
  business_identity_level = 'regulator_linked'
WHERE business_identity_level = 'nrs_linked';

-- Step 3: Update compute_business_identity_level trigger to support both legacy and new values
CREATE OR REPLACE FUNCTION public.compute_business_identity_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip computation if already at a verified or regulator-linked level
  -- Support both nrs_linked (legacy) and regulator_linked (new)
  IF NEW.business_identity_level IN ('verified', 'nrs_linked', 'regulator_linked') THEN
    RETURN NEW;
  END IF;

  -- Compute identity level based on business profile completeness
  IF NEW.registration_status = 'registered'
     AND NEW.tax_id IS NOT NULL AND NEW.tax_id != ''
     AND NEW.legal_name IS NOT NULL AND NEW.legal_name != ''
     AND NEW.contact_email IS NOT NULL
     AND NEW.address IS NOT NULL
     AND (NEW.address->>'city') IS NOT NULL
  THEN
    NEW.business_identity_level := 'self_declared';
  ELSE
    NEW.business_identity_level := 'unverified';
  END IF;

  RETURN NEW;
END;
$$;

-- Step 4: Add index for regulator_code lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_businesses_regulator_code 
ON public.businesses (regulator_code) 
WHERE regulator_code IS NOT NULL;

-- Step 5: Add comment documenting the column purpose
COMMENT ON COLUMN public.businesses.regulator_code IS 'Jurisdiction-specific regulatory linkage code (e.g., NGA-NRS, GBR-HMRC). Required when business_identity_level = regulator_linked.';