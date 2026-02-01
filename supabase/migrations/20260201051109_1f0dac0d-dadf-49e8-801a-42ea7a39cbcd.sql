-- Add VAT registration fields to businesses table for Nigerian compliance
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS vat_registration_number text,
  ADD COLUMN IF NOT EXISTS is_vat_registered boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.businesses.vat_registration_number IS 'VAT Registration Number issued by FIRS (required for VAT-registered Nigerian businesses)';
COMMENT ON COLUMN public.businesses.is_vat_registered IS 'Whether the business is registered for VAT with FIRS';

-- Update the compute_business_compliance function to include VAT fields for Nigerian businesses
CREATE OR REPLACE FUNCTION public.compute_business_compliance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Base compliance check
  IF NEW.name IS NOT NULL 
    AND NEW.legal_name IS NOT NULL
    AND NEW.tax_id IS NOT NULL
    AND NEW.contact_email IS NOT NULL
    AND NEW.address IS NOT NULL
    AND (NEW.address->>'city') IS NOT NULL
    AND (NEW.address->>'country') IS NOT NULL
  THEN
    -- Additional check for Nigerian businesses: if VAT registered, must have VAT number
    IF NEW.jurisdiction = 'NG' AND NEW.is_vat_registered = true AND (NEW.vat_registration_number IS NULL OR NEW.vat_registration_number = '') THEN
      NEW.compliance_status := 'incomplete';
    ELSE
      NEW.compliance_status := 'complete';
    END IF;
  ELSE
    NEW.compliance_status := 'incomplete';
  END IF;
  
  RETURN NEW;
END;
$function$;