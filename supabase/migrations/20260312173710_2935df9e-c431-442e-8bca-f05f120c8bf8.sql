
-- Add invoice_number_digits column to businesses
ALTER TABLE public.businesses
ADD COLUMN invoice_number_digits integer NOT NULL DEFAULT 4;

-- Add check constraint via trigger (avoiding CHECK constraint for flexibility)
CREATE OR REPLACE FUNCTION public.validate_invoice_number_digits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number_digits < 1 OR NEW.invoice_number_digits > 15 THEN
    RAISE EXCEPTION 'invoice_number_digits must be between 1 and 15';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_invoice_number_digits
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.validate_invoice_number_digits();

-- Update generate_invoice_number to use the configurable digits
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prefix TEXT;
  _next INT;
  _digits INT;
BEGIN
  -- Verify caller is a member of the business
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this business';
  END IF;

  -- Atomically increment and get the next number
  UPDATE businesses
  SET next_invoice_number = COALESCE(next_invoice_number, 1) + 1
  WHERE id = _business_id
  RETURNING COALESCE(invoice_prefix, 'INV'), next_invoice_number - 1, COALESCE(invoice_number_digits, 4)
  INTO _prefix, _next, _digits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found: %', _business_id;
  END IF;

  RETURN _prefix || '-' || LPAD(_next::text, _digits, '0');
END;
$$;
