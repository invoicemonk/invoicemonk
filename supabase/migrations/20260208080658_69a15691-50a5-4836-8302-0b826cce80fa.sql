
-- 1a. Trigger: compute_business_identity_level
CREATE OR REPLACE FUNCTION public.compute_business_identity_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.business_identity_level IN ('verified', 'nrs_linked') THEN
    RETURN NEW;
  END IF;

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

CREATE TRIGGER compute_business_identity_level_trigger
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION compute_business_identity_level();

-- 1b. Trigger: validate_invoice_currency
CREATE OR REPLACE FUNCTION public.validate_invoice_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _default_currency TEXT;
  _allowed TEXT[];
BEGIN
  IF NEW.business_id IS NULL THEN RETURN NEW; END IF;

  SELECT default_currency, COALESCE(allowed_currencies, ARRAY[]::text[])
  INTO _default_currency, _allowed
  FROM businesses WHERE id = NEW.business_id;

  IF _default_currency IS NULL THEN RETURN NEW; END IF;

  IF NEW.currency != _default_currency
     AND NOT (NEW.currency = ANY(_allowed))
  THEN
    RAISE EXCEPTION 'Currency % is not permitted. Permitted currencies: %',
      NEW.currency, array_to_string(_default_currency || _allowed, ', ');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_invoice_currency_trigger
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_currency();

-- 1c. Updated validate_expense_currency (replace existing function)
CREATE OR REPLACE FUNCTION public.validate_expense_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _business_primary TEXT;
  _allowed TEXT[];
BEGIN
  IF NEW.business_id IS NOT NULL THEN
    SELECT default_currency, COALESCE(allowed_currencies, ARRAY[]::text[])
    INTO _business_primary, _allowed
    FROM public.businesses WHERE id = NEW.business_id;

    IF _business_primary IS NOT NULL THEN
      -- Enforce allowed currencies
      IF NEW.currency != _business_primary
         AND NOT (NEW.currency = ANY(_allowed))
      THEN
        RAISE EXCEPTION 'Currency % is not permitted for this business. Permitted: %',
          NEW.currency, array_to_string(_business_primary || _allowed, ', ');
      END IF;

      -- Require exchange rate for non-primary currency
      IF NEW.currency != _business_primary THEN
        IF NEW.exchange_rate_to_primary IS NULL THEN
          RAISE EXCEPTION 'Exchange rate required for non-primary currency expenses. Business primary: %, expense: %',
            _business_primary, NEW.currency;
        END IF;
        NEW.primary_currency := _business_primary;
      ELSE
        NEW.primary_currency := _business_primary;
        NEW.exchange_rate_to_primary := 1;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 1d. Trigger: prevent_allowed_currency_removal
CREATE OR REPLACE FUNCTION public.prevent_allowed_currency_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _removed_currency TEXT;
  _old_currencies TEXT[];
  _new_currencies TEXT[];
BEGIN
  _old_currencies := COALESCE(OLD.allowed_currencies, ARRAY[]::text[]);
  _new_currencies := COALESCE(NEW.allowed_currencies, ARRAY[]::text[]);

  FOREACH _removed_currency IN ARRAY _old_currencies
  LOOP
    IF NOT (_removed_currency = ANY(_new_currencies)) THEN
      IF EXISTS (
        SELECT 1 FROM invoices
        WHERE business_id = NEW.id
          AND currency = _removed_currency
          AND status != 'draft'
      ) THEN
        RAISE EXCEPTION 'Cannot remove currency % -- it has been used on issued invoices.',
          _removed_currency;
      END IF;
      IF EXISTS (
        SELECT 1 FROM expenses
        WHERE business_id = NEW.id
          AND currency = _removed_currency
      ) THEN
        RAISE EXCEPTION 'Cannot remove currency % -- it has been used on recorded expenses.',
          _removed_currency;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_allowed_currency_removal_trigger
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  WHEN (OLD.allowed_currencies IS DISTINCT FROM NEW.allowed_currencies)
  EXECUTE FUNCTION prevent_allowed_currency_removal();
