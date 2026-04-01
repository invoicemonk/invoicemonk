
-- 1. Drop the duplicate get_cashflow_summary with date params (keep timestamptz version)
DROP FUNCTION IF EXISTS public.get_cashflow_summary(uuid, uuid, date, date);

-- 2. Fix get_profitability_stats to handle NULL dates
CREATE OR REPLACE FUNCTION public.get_profitability_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_gross_revenue numeric;
  v_total_expenses numeric;
  v_expense_breakdown jsonb;
  v_monthly_trend jsonb;
  v_effective_start date;
  v_effective_end date;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- For monthly trend, we need concrete dates even for all-time
  IF _start_date IS NULL THEN
    SELECT COALESCE(MIN(p.payment_date), CURRENT_DATE - interval '1 year')
    INTO v_effective_start
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.business_id = _business_id;
  ELSE
    v_effective_start := _start_date;
  END IF;

  IF _end_date IS NULL THEN
    v_effective_end := CURRENT_DATE;
  ELSE
    v_effective_end := _end_date;
  END IF;

  -- Gross revenue (payments received in period)
  SELECT COALESCE(SUM(p.amount), 0) INTO v_gross_revenue
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND (_start_date IS NULL OR p.payment_date >= _start_date)
    AND (_end_date IS NULL OR p.payment_date <= _end_date)
    AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id);

  -- Total expenses in period
  SELECT COALESCE(SUM(e.amount), 0) INTO v_total_expenses
  FROM expenses e
  WHERE e.business_id = _business_id
    AND (_start_date IS NULL OR e.expense_date >= _start_date)
    AND (_end_date IS NULL OR e.expense_date <= _end_date)
    AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id);

  -- Expense breakdown by category
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category', e.category,
    'total', e.cat_total
  ) ORDER BY e.cat_total DESC), '[]'::jsonb) INTO v_expense_breakdown
  FROM (
    SELECT category, SUM(amount) AS cat_total
    FROM expenses
    WHERE business_id = _business_id
      AND (_start_date IS NULL OR expense_date >= _start_date)
      AND (_end_date IS NULL OR expense_date <= _end_date)
      AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    GROUP BY category
  ) e;

  -- Monthly revenue vs expense trend
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', m.month_start,
    'revenue', m.revenue,
    'expenses', m.expenses,
    'profit', m.revenue - m.expenses
  ) ORDER BY m.month_start), '[]'::jsonb) INTO v_monthly_trend
  FROM (
    SELECT
      date_trunc('month', d)::date AS month_start,
      COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE i.business_id = _business_id
          AND p.payment_date >= date_trunc('month', d)::date
          AND p.payment_date < (date_trunc('month', d) + interval '1 month')::date
          AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id)
      ), 0) AS revenue,
      COALESCE((
        SELECT SUM(ex.amount)
        FROM expenses ex
        WHERE ex.business_id = _business_id
          AND ex.expense_date >= date_trunc('month', d)::date
          AND ex.expense_date < (date_trunc('month', d) + interval '1 month')::date
          AND (_currency_account_id IS NULL OR ex.currency_account_id = _currency_account_id)
      ), 0) AS expenses
    FROM generate_series(
      date_trunc('month', v_effective_start::timestamp),
      date_trunc('month', v_effective_end::timestamp),
      interval '1 month'
    ) d
  ) m;

  result := jsonb_build_object(
    'gross_revenue', v_gross_revenue,
    'total_expenses', v_total_expenses,
    'net_profit', v_gross_revenue - v_total_expenses,
    'profit_margin_pct', CASE WHEN v_gross_revenue > 0 THEN ROUND(((v_gross_revenue - v_total_expenses) / v_gross_revenue) * 100, 1) ELSE 0 END,
    'expense_breakdown', v_expense_breakdown,
    'monthly_trend', v_monthly_trend,
    'period_start', v_effective_start,
    'period_end', v_effective_end
  );

  RETURN result;
END;
$$;

-- 3. Update get_dashboard_stats to also return total_invoiced
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL,
  _date_start timestamptz DEFAULT NULL,
  _date_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  _currency TEXT;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT COALESCE(default_currency, 'NGN') INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount_paid) FILTER (WHERE status NOT IN ('draft', 'voided')), 0),
    'total_invoiced', COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('draft', 'voided')), 0),
    'outstanding', COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('issued', 'sent', 'viewed') AND total_amount > amount_paid), 0),
    'outstanding_count', COUNT(*) FILTER (WHERE status IN ('issued', 'sent', 'viewed') AND total_amount > amount_paid),
    'paid_this_month', COALESCE(SUM(amount_paid) FILTER (
      WHERE status NOT IN ('draft', 'voided') 
      AND amount_paid > 0
      AND issued_at >= date_trunc('month', COALESCE(_date_start, now()))
      AND issued_at <= COALESCE(_date_end, (date_trunc('month', now()) + interval '1 month - 1 second'))
    ), 0),
    'paid_this_month_count', COUNT(*) FILTER (
      WHERE status NOT IN ('draft', 'voided') 
      AND amount_paid > 0
      AND issued_at >= date_trunc('month', COALESCE(_date_start, now()))
      AND issued_at <= COALESCE(_date_end, (date_trunc('month', now()) + interval '1 month - 1 second'))
    ),
    'draft_count', COUNT(*) FILTER (WHERE status = 'draft'),
    'currency', _currency
  )
  INTO result
  FROM invoices
  WHERE business_id = _business_id
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    AND (
      _date_start IS NULL 
      OR status = 'draft' 
      OR issued_at >= _date_start
    )
    AND (
      _date_end IS NULL 
      OR status = 'draft' 
      OR issued_at <= _date_end
    );

  RETURN result;
END;
$$;
