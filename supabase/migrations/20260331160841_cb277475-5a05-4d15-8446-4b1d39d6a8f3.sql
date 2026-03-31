CREATE OR REPLACE FUNCTION public.set_default_currency_account(_business_id uuid, _account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller owns/admins the business
  IF NOT (
    has_business_role(auth.uid(), _business_id, 'owner') OR
    has_business_role(auth.uid(), _business_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Verify account belongs to business
  IF NOT EXISTS (
    SELECT 1 FROM currency_accounts WHERE id = _account_id AND business_id = _business_id
  ) THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Swap defaults
  UPDATE currency_accounts SET is_default = false, updated_at = now() WHERE business_id = _business_id;
  UPDATE currency_accounts SET is_default = true, updated_at = now() WHERE id = _account_id AND business_id = _business_id;
END;
$$;