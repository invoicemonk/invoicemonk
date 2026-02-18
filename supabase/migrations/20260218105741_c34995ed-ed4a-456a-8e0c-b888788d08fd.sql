
-- Fix get_accounting_stats: exp_result was JSONB but receiving COUNT(*) bigint
CREATE OR REPLACE FUNCTION public.get_accounting_stats(
  _business_id UUID,
  _currency_account_id UUID DEFAULT NULL,
  _date_start TIMESTAMPTZ DEFAULT NULL,
  _date_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv_result JSONB;
  _currency TEXT;
  _money_in NUMERIC;
  _money_out NUMERIC;
  _expense_count BIGINT;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get currency
  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT COALESCE(default_currency, 'NGN') INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  -- Invoice stats
  SELECT jsonb_build_object(
    'revenue', COALESCE(SUM(total_amount) FILTER (WHERE status IN ('issued', 'sent', 'viewed', 'paid')), 0),
    'revenue_count', COUNT(*) FILTER (WHERE status IN ('issued', 'sent', 'viewed', 'paid')),
    'money_in', COALESCE(SUM(amount_paid) FILTER (WHERE status NOT IN ('draft', 'voided')), 0),
    'money_in_count', COUNT(*) FILTER (WHERE status NOT IN ('draft', 'voided') AND amount_paid > 0),
    'outstanding', COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('issued', 'sent', 'viewed') AND total_amount > amount_paid), 0),
    'outstanding_count', COUNT(*) FILTER (WHERE status IN ('issued', 'sent', 'viewed') AND total_amount > amount_paid)
  )
  INTO inv_result
  FROM invoices
  WHERE business_id = _business_id
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR issued_at >= _date_start)
    AND (_date_end IS NULL OR issued_at <= _date_end);

  _money_in := (inv_result->>'money_in')::numeric;

  -- Expense stats
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO _money_out, _expense_count
  FROM expenses
  WHERE business_id = _business_id
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR expense_date >= (_date_start)::date)
    AND (_date_end IS NULL OR expense_date <= (_date_end)::date);

  RETURN inv_result || jsonb_build_object(
    'money_out', _money_out,
    'expense_count', _expense_count,
    'whats_left', _money_in - _money_out,
    'currency', _currency
  );
END;
$$;
