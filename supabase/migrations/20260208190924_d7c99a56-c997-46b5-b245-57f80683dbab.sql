-- ============================================================================
-- CURRENCY ACCOUNTS: Complete Schema Migration
-- ============================================================================

-- 1. Create currency_accounts table
CREATE TABLE currency_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(business_id, currency)
);

-- Ensure only one default currency account per business
CREATE UNIQUE INDEX currency_accounts_default_unique 
  ON currency_accounts(business_id) WHERE is_default = true;

-- Enable RLS
ALTER TABLE currency_accounts ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies for currency_accounts
CREATE POLICY "Business members can view currency accounts"
  ON currency_accounts FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Business admins can create currency accounts"
  ON currency_accounts FOR INSERT
  WITH CHECK (
    has_business_role(auth.uid(), business_id, 'owner') OR
    has_business_role(auth.uid(), business_id, 'admin')
  );

CREATE POLICY "Business admins can update currency accounts"
  ON currency_accounts FOR UPDATE
  USING (
    has_business_role(auth.uid(), business_id, 'owner') OR
    has_business_role(auth.uid(), business_id, 'admin')
  );

CREATE POLICY "Business owners can delete non-default currency accounts"
  ON currency_accounts FOR DELETE
  USING (
    has_business_role(auth.uid(), business_id, 'owner') AND
    is_default = false
  );

-- 3. Add currency_account_id to financial tables
ALTER TABLE invoices 
  ADD COLUMN currency_account_id UUID REFERENCES currency_accounts(id);

ALTER TABLE expenses 
  ADD COLUMN currency_account_id UUID REFERENCES currency_accounts(id);

ALTER TABLE receipts 
  ADD COLUMN currency_account_id UUID REFERENCES currency_accounts(id);

ALTER TABLE credit_notes 
  ADD COLUMN currency_account_id UUID REFERENCES currency_accounts(id);

ALTER TABLE payments 
  ADD COLUMN currency_account_id UUID REFERENCES currency_accounts(id);

-- 4. Validation trigger: Ensure currency matches currency account
CREATE OR REPLACE FUNCTION validate_currency_account_match()
RETURNS TRIGGER AS $$
DECLARE
  account_currency TEXT;
BEGIN
  IF NEW.currency_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT currency INTO account_currency
  FROM currency_accounts
  WHERE id = NEW.currency_account_id;
  
  IF account_currency IS NULL THEN
    RAISE EXCEPTION 'Currency account not found';
  END IF;
  
  IF NEW.currency != account_currency THEN
    RAISE EXCEPTION 'Currency (%) does not match currency account currency (%)', 
      NEW.currency, account_currency;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply validation trigger to invoices
CREATE TRIGGER invoice_currency_account_check
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_currency_account_match();

-- Apply validation trigger to expenses
CREATE TRIGGER expense_currency_account_check
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_currency_account_match();

-- Apply validation trigger to credit_notes
CREATE TRIGGER credit_note_currency_account_check
  BEFORE INSERT OR UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION validate_currency_account_match();

-- 5. Receipt inherits currency_account_id from invoice
CREATE OR REPLACE FUNCTION receipt_inherit_currency_account()
RETURNS TRIGGER AS $$
DECLARE
  invoice_currency_account_id UUID;
  invoice_currency TEXT;
BEGIN
  SELECT currency_account_id, currency INTO invoice_currency_account_id, invoice_currency
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  IF invoice_currency_account_id IS NOT NULL THEN
    NEW.currency_account_id := invoice_currency_account_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER receipt_inherit_currency_account_trigger
  BEFORE INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION receipt_inherit_currency_account();

-- 6. Payment inherits currency_account_id from invoice
CREATE OR REPLACE FUNCTION payment_inherit_currency_account()
RETURNS TRIGGER AS $$
DECLARE
  invoice_currency_account_id UUID;
BEGIN
  SELECT currency_account_id INTO invoice_currency_account_id
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  IF invoice_currency_account_id IS NOT NULL THEN
    NEW.currency_account_id := invoice_currency_account_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER payment_inherit_currency_account_trigger
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION payment_inherit_currency_account();

-- 7. Tier limit function for currency accounts
CREATE OR REPLACE FUNCTION check_currency_account_limit(_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_tier subscription_tier;
  account_count INTEGER;
  max_accounts INTEGER;
BEGIN
  SELECT tier INTO current_tier
  FROM subscriptions
  WHERE business_id = _business_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF current_tier IS NULL THEN
    current_tier := 'starter';
  END IF;
  
  SELECT COUNT(*) INTO account_count
  FROM currency_accounts
  WHERE business_id = _business_id;
  
  CASE current_tier
    WHEN 'starter' THEN max_accounts := 1;
    WHEN 'starter_paid' THEN max_accounts := 1;
    WHEN 'professional' THEN max_accounts := 3;
    WHEN 'business' THEN max_accounts := NULL;
    ELSE max_accounts := 1;
  END CASE;
  
  RETURN jsonb_build_object(
    'tier', current_tier,
    'current_count', account_count,
    'limit', max_accounts,
    'allowed', (max_accounts IS NULL OR account_count < max_accounts)
  );
END;
$$;

-- 8. Backfill: Create default currency accounts for all businesses
INSERT INTO currency_accounts (business_id, currency, is_default, name)
SELECT 
  id,
  COALESCE(default_currency, 'NGN'),
  true,
  COALESCE(default_currency, 'NGN') || ' Account'
FROM businesses
ON CONFLICT (business_id, currency) DO NOTHING;

-- 9. Backfill invoices
UPDATE invoices i
SET currency_account_id = ca.id
FROM currency_accounts ca
WHERE i.business_id = ca.business_id 
  AND (i.currency = ca.currency OR (i.currency IS NULL AND ca.is_default = true))
  AND i.currency_account_id IS NULL;

-- 10. Backfill expenses
UPDATE expenses e
SET currency_account_id = ca.id
FROM currency_accounts ca
WHERE e.business_id = ca.business_id 
  AND (e.currency = ca.currency OR (e.currency IS NULL AND ca.is_default = true))
  AND e.currency_account_id IS NULL;

-- 11. Backfill receipts
UPDATE receipts r
SET currency_account_id = ca.id
FROM currency_accounts ca
WHERE r.business_id = ca.business_id 
  AND (r.currency = ca.currency OR (r.currency IS NULL AND ca.is_default = true))
  AND r.currency_account_id IS NULL;

-- 12. Backfill credit notes
UPDATE credit_notes cn
SET currency_account_id = ca.id
FROM currency_accounts ca
WHERE cn.business_id = ca.business_id 
  AND (cn.currency = ca.currency OR (cn.currency IS NULL AND ca.is_default = true))
  AND cn.currency_account_id IS NULL;

-- 13. Backfill payments via their invoices
UPDATE payments p
SET currency_account_id = i.currency_account_id
FROM invoices i
WHERE p.invoice_id = i.id
  AND p.currency_account_id IS NULL
  AND i.currency_account_id IS NOT NULL;

-- 14. Create indexes for performance
CREATE INDEX idx_invoices_currency_account ON invoices(currency_account_id);
CREATE INDEX idx_expenses_currency_account ON expenses(currency_account_id);
CREATE INDEX idx_receipts_currency_account ON receipts(currency_account_id);
CREATE INDEX idx_credit_notes_currency_account ON credit_notes(currency_account_id);
CREATE INDEX idx_payments_currency_account ON payments(currency_account_id);
CREATE INDEX idx_currency_accounts_business ON currency_accounts(business_id);