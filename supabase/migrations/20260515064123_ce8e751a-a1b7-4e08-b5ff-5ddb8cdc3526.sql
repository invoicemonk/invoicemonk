
-- 1. Fix compute_business_compliance: read government_id_value from business_sensitive_data
CREATE OR REPLACE FUNCTION public.compute_business_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  score integer := 0;
  total integer := 0;
  new_status text;
  v_gov_id text;
BEGIN
  IF NEW.entity_type = 'individual' THEN
    total := total + 1;
    IF NEW.name IS NOT NULL AND NEW.name != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF NEW.address IS NOT NULL AND NEW.address->>'country' IS NOT NULL AND NEW.address->>'country' != '' THEN score := score + 1; END IF;
  ELSE
    SELECT government_id_value INTO v_gov_id
      FROM public.business_sensitive_data
      WHERE business_id = NEW.id;

    total := total + 1;
    IF NEW.name IS NOT NULL AND NEW.name != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF NEW.legal_name IS NOT NULL AND NEW.legal_name != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF v_gov_id IS NOT NULL AND v_gov_id != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF NEW.address IS NOT NULL AND NEW.address->>'city' IS NOT NULL AND NEW.address->>'city' != '' THEN score := score + 1; END IF;
    total := total + 1;
    IF NEW.address IS NOT NULL AND NEW.address->>'country' IS NOT NULL AND NEW.address->>'country' != '' THEN score := score + 1; END IF;
  END IF;

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
$function$;

-- 2. Fix compute_business_identity_level: read tax_id from business_sensitive_data
CREATE OR REPLACE FUNCTION public.compute_business_identity_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tax_id text;
BEGIN
  IF NEW.business_identity_level IN ('verified', 'nrs_linked', 'regulator_linked') THEN
    RETURN NEW;
  END IF;

  SELECT tax_id INTO v_tax_id
    FROM public.business_sensitive_data
    WHERE business_id = NEW.id;

  IF NEW.registration_status = 'registered'
     AND v_tax_id IS NOT NULL AND v_tax_id != ''
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
$function$;

-- 3. Fix on_sensitive_field_change: drop tax_id check (handled by sensitive table trigger below)
CREATE OR REPLACE FUNCTION public.on_sensitive_field_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.verification_status = 'verified' THEN
    IF (OLD.legal_name IS DISTINCT FROM NEW.legal_name)
       OR (OLD.jurisdiction IS DISTINCT FROM NEW.jurisdiction) THEN
      NEW.verification_status := 'pending_review';
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. New trigger on business_sensitive_data: downgrade verification on tax_id change
CREATE OR REPLACE FUNCTION public.on_sensitive_data_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.tax_id IS DISTINCT FROM NEW.tax_id
     OR OLD.government_id_value IS DISTINCT FROM NEW.government_id_value THEN
    UPDATE public.businesses
       SET verification_status = 'pending_review',
           verified_at = NULL,
           verified_by = NULL
     WHERE id = NEW.business_id
       AND verification_status = 'verified';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sensitive_data_change ON public.business_sensitive_data;
CREATE TRIGGER trg_sensitive_data_change
BEFORE UPDATE ON public.business_sensitive_data
FOR EACH ROW EXECUTE FUNCTION public.on_sensitive_data_change();
