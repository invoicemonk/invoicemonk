-- 1. Create the invoice_kind enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_kind') THEN
    CREATE TYPE public.invoice_kind AS ENUM ('standard', 'deposit', 'final');
  END IF;
END$$;

-- 2. Add new columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS kind public.invoice_kind NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS deposit_percent numeric(5,2) NULL;

-- 3. Index on parent_invoice_id for sibling lookups
CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice_id 
  ON public.invoices (parent_invoice_id) 
  WHERE parent_invoice_id IS NOT NULL;

-- 4. Unique constraint: one deposit can only be consumed by one final invoice
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_parent 
  ON public.invoices (parent_invoice_id) 
  WHERE parent_invoice_id IS NOT NULL;

-- 5. Validation trigger for kind/parent relationships
CREATE OR REPLACE FUNCTION public.validate_invoice_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_kind public.invoice_kind;
  parent_business_id uuid;
  parent_client_id uuid;
  parent_currency text;
BEGIN
  -- deposit_percent only makes sense on deposit invoices
  IF NEW.deposit_percent IS NOT NULL THEN
    IF NEW.kind <> 'deposit' THEN
      RAISE EXCEPTION 'deposit_percent can only be set on deposit invoices';
    END IF;
    IF NEW.deposit_percent <= 0 OR NEW.deposit_percent > 100 THEN
      RAISE EXCEPTION 'deposit_percent must be between 0 and 100';
    END IF;
  END IF;

  -- parent_invoice_id rules
  IF NEW.parent_invoice_id IS NOT NULL THEN
    IF NEW.kind <> 'final' THEN
      RAISE EXCEPTION 'Only final invoices can reference a parent (deposit) invoice';
    END IF;

    SELECT kind, business_id, client_id, currency
      INTO parent_kind, parent_business_id, parent_client_id, parent_currency
    FROM public.invoices
    WHERE id = NEW.parent_invoice_id;

    IF parent_kind IS NULL THEN
      RAISE EXCEPTION 'Parent invoice not found';
    END IF;

    IF parent_kind <> 'deposit' THEN
      RAISE EXCEPTION 'parent_invoice_id must reference a deposit invoice (got %)', parent_kind;
    END IF;

    -- Same business
    IF parent_business_id IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Final invoice must belong to the same business as its deposit';
    END IF;

    -- Same client
    IF parent_client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Final invoice must be for the same client as its deposit';
    END IF;

    -- Same currency
    IF parent_currency IS DISTINCT FROM NEW.currency THEN
      RAISE EXCEPTION 'Final invoice must use the same currency as its deposit';
    END IF;
  END IF;

  -- A final invoice without a parent doesn't make sense
  IF NEW.kind = 'final' AND NEW.parent_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Final invoices must reference a parent deposit invoice';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_invoice_kind ON public.invoices;
CREATE TRIGGER trg_validate_invoice_kind
  BEFORE INSERT OR UPDATE OF kind, parent_invoice_id, deposit_percent, business_id, client_id, currency
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invoice_kind();