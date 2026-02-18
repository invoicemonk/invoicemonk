-- Step 1: Add nullable column
ALTER TABLE products_services
  ADD COLUMN currency_account_id UUID REFERENCES currency_accounts(id) ON DELETE CASCADE;

-- Step 2: Backfill — assign each product to the default currency account of its business
UPDATE products_services ps
SET currency_account_id = (
  SELECT ca.id
  FROM currency_accounts ca
  WHERE ca.business_id = ps.business_id
  ORDER BY ca.is_default DESC, ca.created_at ASC
  LIMIT 1
)
WHERE ps.currency_account_id IS NULL;

-- Step 3: Backfill currency column to match the assigned currency account
UPDATE products_services ps
SET currency = (
  SELECT ca.currency
  FROM currency_accounts ca
  WHERE ca.id = ps.currency_account_id
)
WHERE ps.currency_account_id IS NOT NULL;

-- Step 4: Make NOT NULL after backfill
ALTER TABLE products_services
  ALTER COLUMN currency_account_id SET NOT NULL;

-- Step 5: Performance index
CREATE INDEX idx_products_services_currency_account
  ON products_services(currency_account_id);

-- Step 6: Drop old SKU uniqueness index if it exists
DROP INDEX IF EXISTS products_services_sku_business_unique;

-- Step 7: New unique SKU per currency account
CREATE UNIQUE INDEX products_services_sku_currency_account_unique
  ON products_services(currency_account_id, sku)
  WHERE sku IS NOT NULL;