
-- Phase 2A: get_cashflow_summary RPC
CREATE OR REPLACE FUNCTION public.get_cashflow_summary(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL,
  _start_date date DEFAULT (now() - interval '30 days')::date,
  _end_date date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_inflow numeric;
  v_outflow numeric;
  v_prev_inflow numeric;
  v_prev_outflow numeric;
  v_period_days integer;
  v_prev_start date;
  v_prev_end date;
BEGIN
  -- Authorization check
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_period_days := _end_date - _start_date;
  v_prev_end := _start_date - interval '1 day';
  v_prev_start := v_prev_end - v_period_days;

  -- Current period inflow (payments received)
  SELECT COALESCE(SUM(p.amount), 0) INTO v_inflow
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND p.payment_date BETWEEN _start_date AND _end_date
    AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id);

  -- Current period outflow (expenses)
  SELECT COALESCE(SUM(e.amount), 0) INTO v_outflow
  FROM expenses e
  WHERE e.business_id = _business_id
    AND e.expense_date BETWEEN _start_date AND _end_date
    AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id);

  -- Previous period inflow
  SELECT COALESCE(SUM(p.amount), 0) INTO v_prev_inflow
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND p.payment_date BETWEEN v_prev_start AND v_prev_end
    AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id);

  -- Previous period outflow
  SELECT COALESCE(SUM(e.amount), 0) INTO v_prev_outflow
  FROM expenses e
  WHERE e.business_id = _business_id
    AND e.expense_date BETWEEN v_prev_start AND v_prev_end
    AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id);

  result := jsonb_build_object(
    'inflow', v_inflow,
    'outflow', v_outflow,
    'net_cashflow', v_inflow - v_outflow,
    'prev_inflow', v_prev_inflow,
    'prev_outflow', v_prev_outflow,
    'prev_net_cashflow', v_prev_inflow - v_prev_outflow,
    'inflow_change_pct', CASE WHEN v_prev_inflow > 0 THEN ROUND(((v_inflow - v_prev_inflow) / v_prev_inflow) * 100, 1) ELSE NULL END,
    'outflow_change_pct', CASE WHEN v_prev_outflow > 0 THEN ROUND(((v_outflow - v_prev_outflow) / v_prev_outflow) * 100, 1) ELSE NULL END,
    'net_change_pct', CASE WHEN (v_prev_inflow - v_prev_outflow) <> 0 THEN ROUND((((v_inflow - v_outflow) - (v_prev_inflow - v_prev_outflow)) / ABS(v_prev_inflow - v_prev_outflow)) * 100, 1) ELSE NULL END,
    'period_start', _start_date,
    'period_end', _end_date
  );

  RETURN result;
END;
$$;

-- Phase 2B: get_receivables_intelligence RPC
CREATE OR REPLACE FUNCTION public.get_receivables_intelligence(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_total_outstanding numeric;
  v_overdue_amount numeric;
  v_aging jsonb;
  v_slow_payers jsonb;
BEGIN
  -- Authorization check
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Total outstanding (issued/overdue invoices with remaining balance)
  SELECT COALESCE(SUM(i.total_amount - i.amount_paid), 0) INTO v_total_outstanding
  FROM invoices i
  WHERE i.business_id = _business_id
    AND i.status IN ('issued', 'overdue')
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id);

  -- Overdue amount
  SELECT COALESCE(SUM(i.total_amount - i.amount_paid), 0) INTO v_overdue_amount
  FROM invoices i
  WHERE i.business_id = _business_id
    AND i.status IN ('issued', 'overdue')
    AND i.due_date < CURRENT_DATE
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id);

  -- Aging buckets
  SELECT jsonb_build_object(
    'current', COALESCE(SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.total_amount - i.amount_paid ELSE 0 END), 0),
    'days_1_30', COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - 30 THEN i.total_amount - i.amount_paid ELSE 0 END), 0),
    'days_31_60', COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60 THEN i.total_amount - i.amount_paid ELSE 0 END), 0),
    'days_61_90', COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 60 AND i.due_date >= CURRENT_DATE - 90 THEN i.total_amount - i.amount_paid ELSE 0 END), 0),
    'days_90_plus', COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 90 THEN i.total_amount - i.amount_paid ELSE 0 END), 0)
  ) INTO v_aging
  FROM invoices i
  WHERE i.business_id = _business_id
    AND i.status IN ('issued', 'overdue')
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id);

  -- Top 5 slow-paying clients (avg days from issue to payment)
  SELECT COALESCE(jsonb_agg(slow_payer ORDER BY avg_days_to_pay DESC), '[]'::jsonb) INTO v_slow_payers
  FROM (
    SELECT jsonb_build_object(
      'client_id', c.id,
      'client_name', c.name,
      'avg_days_to_pay', ROUND(AVG(p.payment_date - i.issue_date)),
      'outstanding_amount', COALESCE(SUM(CASE WHEN i.status IN ('issued', 'overdue') THEN i.total_amount - i.amount_paid ELSE 0 END), 0),
      'invoice_count', COUNT(DISTINCT i.id)
    ) AS slow_payer,
    ROUND(AVG(p.payment_date - i.issue_date)) AS avg_days_to_pay
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    JOIN payments p ON p.invoice_id = i.id
    WHERE i.business_id = _business_id
      AND i.issue_date IS NOT NULL
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    GROUP BY c.id, c.name
    HAVING COUNT(p.id) >= 1
    ORDER BY avg_days_to_pay DESC
    LIMIT 5
  ) sub;

  result := jsonb_build_object(
    'total_outstanding', v_total_outstanding,
    'overdue_amount', v_overdue_amount,
    'aging', v_aging,
    'slow_payers', v_slow_payers
  );

  RETURN result;
END;
$$;

-- Phase 2C: get_profitability_stats RPC
CREATE OR REPLACE FUNCTION public.get_profitability_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL,
  _start_date date DEFAULT (now() - interval '12 months')::date,
  _end_date date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_gross_revenue numeric;
  v_total_expenses numeric;
  v_expense_breakdown jsonb;
  v_monthly_trend jsonb;
BEGIN
  -- Authorization check
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Gross revenue (payments received in period)
  SELECT COALESCE(SUM(p.amount), 0) INTO v_gross_revenue
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND p.payment_date BETWEEN _start_date AND _end_date
    AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id);

  -- Total expenses in period
  SELECT COALESCE(SUM(e.amount), 0) INTO v_total_expenses
  FROM expenses e
  WHERE e.business_id = _business_id
    AND e.expense_date BETWEEN _start_date AND _end_date
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
      AND expense_date BETWEEN _start_date AND _end_date
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
    FROM generate_series(date_trunc('month', _start_date::timestamp), date_trunc('month', _end_date::timestamp), interval '1 month') d
  ) m;

  result := jsonb_build_object(
    'gross_revenue', v_gross_revenue,
    'total_expenses', v_total_expenses,
    'net_profit', v_gross_revenue - v_total_expenses,
    'profit_margin_pct', CASE WHEN v_gross_revenue > 0 THEN ROUND(((v_gross_revenue - v_total_expenses) / v_gross_revenue) * 100, 1) ELSE 0 END,
    'expense_breakdown', v_expense_breakdown,
    'monthly_trend', v_monthly_trend,
    'period_start', _start_date,
    'period_end', _end_date
  );

  RETURN result;
END;
$$;
