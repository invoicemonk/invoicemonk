
-- Create a function that re-evaluates currency lock when invoices are deleted
CREATE OR REPLACE FUNCTION public.reevaluate_currency_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _issued_count INTEGER;
BEGIN
  -- Only act on deletion of non-draft invoices
  IF OLD.status != 'draft' AND OLD.business_id IS NOT NULL THEN
    -- Count remaining non-draft invoices for this business
    SELECT COUNT(*) INTO _issued_count
    FROM invoices
    WHERE business_id = OLD.business_id
      AND status != 'draft'
      AND id != OLD.id;
    
    -- If no more non-draft invoices, unlock the currency
    IF _issued_count = 0 THEN
      UPDATE businesses
      SET currency_locked = false, currency_locked_at = NULL
      WHERE id = OLD.business_id
        AND currency_locked = true;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger on invoice delete to re-evaluate currency lock
CREATE TRIGGER reevaluate_currency_lock_on_delete
BEFORE DELETE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.reevaluate_currency_lock();
