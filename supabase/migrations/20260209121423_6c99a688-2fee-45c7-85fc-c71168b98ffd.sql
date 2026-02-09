
-- 2. Create payment_methods table
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  currency_account_id UUID NOT NULL REFERENCES currency_accounts(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  instructions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_methods_default_unique
  ON payment_methods(currency_account_id) WHERE is_default = true;

CREATE INDEX idx_payment_methods_currency_account
  ON payment_methods(currency_account_id);

CREATE INDEX idx_payment_methods_business
  ON payment_methods(business_id);

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view payment methods"
  ON payment_methods FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Business admins can create payment methods"
  ON payment_methods FOR INSERT
  WITH CHECK (
    has_business_role(auth.uid(), business_id, 'owner') OR
    has_business_role(auth.uid(), business_id, 'admin')
  );

CREATE POLICY "Business admins can update payment methods"
  ON payment_methods FOR UPDATE
  USING (
    has_business_role(auth.uid(), business_id, 'owner') OR
    has_business_role(auth.uid(), business_id, 'admin')
  );

CREATE POLICY "Business owners can delete payment methods"
  ON payment_methods FOR DELETE
  USING (has_business_role(auth.uid(), business_id, 'owner'));

CREATE POLICY "Platform admins can manage payment methods"
  ON payment_methods FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));

-- 3. Create payment_proofs table
CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_proofs_payment ON payment_proofs(payment_id);
CREATE INDEX idx_payment_proofs_invoice ON payment_proofs(invoice_id);

ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view payment proofs"
  ON payment_proofs FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can upload proofs"
  ON payment_proofs FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by AND
    is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Platform admins can view all proofs"
  ON payment_proofs FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

-- 4. Add payment_method_id and snapshot to invoices
ALTER TABLE invoices
  ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id),
  ADD COLUMN payment_method_snapshot JSONB;

-- 5. Validation trigger: currency account match
CREATE OR REPLACE FUNCTION validate_payment_method_currency_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  _pm_currency_account_id UUID;
BEGIN
  IF NEW.payment_method_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.currency_account_id IS NULL THEN
    RAISE EXCEPTION 'Invoice must have a currency_account_id when payment_method_id is set';
  END IF;

  SELECT currency_account_id INTO _pm_currency_account_id
  FROM payment_methods WHERE id = NEW.payment_method_id;

  IF _pm_currency_account_id IS NULL THEN
    RAISE EXCEPTION 'Payment method not found';
  END IF;

  IF _pm_currency_account_id != NEW.currency_account_id THEN
    RAISE EXCEPTION 'Payment method must belong to the same currency account as the invoice';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_invoice_payment_method
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION validate_payment_method_currency_account();

-- 6. Tier limit rows
INSERT INTO tier_limits (tier, feature, limit_value, limit_type, description) VALUES
  ('starter', 'payment_methods_per_currency', 1, 'count', 'Payment methods per currency account'),
  ('starter_paid', 'payment_methods_per_currency', 2, 'count', 'Payment methods per currency account'),
  ('professional', 'payment_methods_per_currency', NULL, 'unlimited', 'Payment methods per currency account'),
  ('business', 'payment_methods_per_currency', NULL, 'unlimited', 'Payment methods per currency account');

-- 7. Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false);

CREATE POLICY "Business members can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Business members can read payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

-- 8. Check payment method limit function
CREATE OR REPLACE FUNCTION check_payment_method_limit(
  _business_id UUID,
  _currency_account_id UUID
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tier subscription_tier;
  _limit_value INTEGER;
  _limit_type TEXT;
  _current_count INTEGER;
BEGIN
  IF has_role(auth.uid(), 'platform_admin') THEN
    RETURN jsonb_build_object('allowed', true, 'tier', 'business',
      'current_count', 0, 'limit', null, 'limit_type', 'unlimited');
  END IF;

  SELECT COALESCE(s.tier, 'starter') INTO _tier
  FROM businesses b
  LEFT JOIN subscriptions s ON s.business_id = b.id AND s.status = 'active'
  WHERE b.id = _business_id
  ORDER BY s.created_at DESC LIMIT 1;

  SELECT tl.limit_value, tl.limit_type INTO _limit_value, _limit_type
  FROM tier_limits tl
  WHERE tl.tier = _tier AND tl.feature = 'payment_methods_per_currency';

  SELECT COUNT(*) INTO _current_count
  FROM payment_methods WHERE currency_account_id = _currency_account_id;

  IF _limit_type = 'unlimited' OR _limit_value IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'tier', _tier,
      'current_count', _current_count, 'limit', null, 'limit_type', 'unlimited');
  END IF;

  RETURN jsonb_build_object('allowed', _current_count < _limit_value,
    'tier', _tier, 'current_count', _current_count,
    'limit', _limit_value, 'limit_type', 'count');
END;
$$;
