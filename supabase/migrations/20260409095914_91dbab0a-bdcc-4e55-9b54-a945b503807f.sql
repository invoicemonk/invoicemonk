-- Add entity_type column
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'business';

-- Add constraint separately (IF NOT EXISTS not supported for constraints, use DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_entity_type'
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT valid_entity_type CHECK (entity_type IN ('individual', 'business', 'nonprofit'));
  END IF;
END $$;

-- Add government ID columns
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS government_id_type text,
ADD COLUMN IF NOT EXISTS government_id_value text,
ADD COLUMN IF NOT EXISTS is_government_id_verified boolean NOT NULL DEFAULT false;

-- Add document verification status
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS document_verification_status text NOT NULL DEFAULT 'not_uploaded';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_doc_verification_status'
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT valid_doc_verification_status CHECK (document_verification_status IN ('not_uploaded', 'pending_review', 'verified', 'rejected'));
  END IF;
END $$;

-- Migrate existing tax_id data into new columns
UPDATE public.businesses
SET government_id_type = 'TIN',
    government_id_value = tax_id
WHERE tax_id IS NOT NULL AND tax_id != '' AND government_id_value IS NULL;

-- Update compute_business_compliance to use government_id_value
CREATE OR REPLACE FUNCTION public.compute_business_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score integer := 0;
  total integer := 0;
  new_status text;
BEGIN
  -- For individuals, fewer fields are required
  IF NEW.entity_type = 'individual' THEN
    -- Name
    total := total + 1;
    IF NEW.name IS NOT NULL AND NEW.name != '' THEN score := score + 1; END IF;
    -- Email
    total := total + 1;
    IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN score := score + 1; END IF;
    -- Country (address->country)
    total := total + 1;
    IF NEW.address IS NOT NULL AND NEW.address->>'country' IS NOT NULL AND NEW.address->>'country' != '' THEN score := score + 1; END IF;
  ELSE
    -- Business / Nonprofit: full requirements
    -- Name
    total := total + 1;
    IF NEW.name IS NOT NULL AND NEW.name != '' THEN score := score + 1; END IF;
    -- Legal name
    total := total + 1;
    IF NEW.legal_name IS NOT NULL AND NEW.legal_name != '' THEN score := score + 1; END IF;
    -- Government ID (replaces tax_id check)
    total := total + 1;
    IF NEW.government_id_value IS NOT NULL AND NEW.government_id_value != '' THEN score := score + 1; END IF;
    -- Email
    total := total + 1;
    IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN score := score + 1; END IF;
    -- City
    total := total + 1;
    IF NEW.address IS NOT NULL AND NEW.address->>'city' IS NOT NULL AND NEW.address->>'city' != '' THEN score := score + 1; END IF;
    -- Country
    total := total + 1;
    IF NEW.address IS NOT NULL AND NEW.address->>'country' IS NOT NULL AND NEW.address->>'country' != '' THEN score := score + 1; END IF;
  END IF;

  -- Determine status
  IF total = 0 THEN
    new_status := 'incomplete';
  ELSIF score = total THEN
    new_status := 'complete';
  ELSE
    new_status := 'incomplete';
  END IF;

  NEW.compliance_status := new_status;
  RETURN NEW;
END;
$$;