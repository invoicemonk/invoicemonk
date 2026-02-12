
-- 1. Trigger function: auto-create default currency account for every new business
CREATE OR REPLACE FUNCTION auto_create_default_currency_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO currency_accounts (business_id, currency, is_default, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.default_currency, 'NGN'),
    true,
    COALESCE(NEW.default_currency, 'NGN') || ' Account'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Attach trigger
CREATE TRIGGER auto_create_default_currency_account_trigger
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_default_currency_account();

-- 3. Backfill existing businesses missing a currency account
INSERT INTO currency_accounts (business_id, currency, is_default, name)
SELECT b.id, COALESCE(b.default_currency, 'NGN'), true,
       COALESCE(b.default_currency, 'NGN') || ' Account'
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM currency_accounts ca WHERE ca.business_id = b.id
);
