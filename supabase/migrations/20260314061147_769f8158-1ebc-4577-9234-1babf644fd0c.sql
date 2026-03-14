
-- Trigger function: sync default currency account when businesses.default_currency changes
CREATE OR REPLACE FUNCTION sync_default_currency_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when default_currency actually changed and is not null
  IF NEW.default_currency IS DISTINCT FROM OLD.default_currency
     AND NEW.default_currency IS NOT NULL THEN

    -- Check if a non-default currency account already exists for the new currency
    IF EXISTS (
      SELECT 1 FROM currency_accounts
      WHERE business_id = NEW.id
        AND currency = NEW.default_currency
        AND is_default = false
    ) THEN
      -- Swap: unset old default, set existing account as default
      UPDATE currency_accounts
      SET is_default = false, updated_at = now()
      WHERE business_id = NEW.id AND is_default = true;

      UPDATE currency_accounts
      SET is_default = true, updated_at = now()
      WHERE business_id = NEW.id AND currency = NEW.default_currency;

    ELSIF EXISTS (
      SELECT 1 FROM currency_accounts
      WHERE business_id = NEW.id AND is_default = true
    ) THEN
      -- Update existing default account's currency and name
      UPDATE currency_accounts
      SET currency = NEW.default_currency,
          name = NEW.default_currency || ' Account',
          updated_at = now()
      WHERE business_id = NEW.id AND is_default = true;

    ELSE
      -- No default account exists, create one
      INSERT INTO currency_accounts (business_id, currency, name, is_default)
      VALUES (NEW.id, NEW.default_currency, NEW.default_currency || ' Account', true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_default_currency_account ON businesses;
CREATE TRIGGER trg_sync_default_currency_account
  AFTER UPDATE OF default_currency ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION sync_default_currency_account();

-- Backfill: fix existing mismatches where no duplicate currency account exists
UPDATE currency_accounts ca
SET currency = b.default_currency,
    name = b.default_currency || ' Account',
    updated_at = now()
FROM businesses b
WHERE ca.business_id = b.id
  AND ca.is_default = true
  AND b.default_currency IS NOT NULL
  AND ca.currency != b.default_currency
  AND NOT EXISTS (
    SELECT 1 FROM currency_accounts ca2
    WHERE ca2.business_id = b.id
      AND ca2.currency = b.default_currency
      AND ca2.id != ca.id
  );
