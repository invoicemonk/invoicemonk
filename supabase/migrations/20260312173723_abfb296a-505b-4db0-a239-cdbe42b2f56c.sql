
-- Fix search_path on validate_invoice_number_digits
CREATE OR REPLACE FUNCTION public.validate_invoice_number_digits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invoice_number_digits < 1 OR NEW.invoice_number_digits > 15 THEN
    RAISE EXCEPTION 'invoice_number_digits must be between 1 and 15';
  END IF;
  RETURN NEW;
END;
$$;
