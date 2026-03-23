
-- Create online_payments table for tracking payment sessions
CREATE TABLE public.online_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paystack')),
  provider_reference text UNIQUE,
  provider_session_id text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  provider_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Index for fast idempotency lookups
CREATE INDEX idx_online_payments_provider_reference ON public.online_payments(provider_reference);
CREATE INDEX idx_online_payments_invoice_id ON public.online_payments(invoice_id);
CREATE INDEX idx_online_payments_business_id ON public.online_payments(business_id);

-- Enable RLS
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;

-- RLS: Business members can SELECT their own records
CREATE POLICY "Business members can view online payments"
  ON public.online_payments FOR SELECT
  TO authenticated
  USING (is_business_member(auth.uid(), business_id));

-- RLS: Platform admins can view all
CREATE POLICY "Platform admins can manage online payments"
  ON public.online_payments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- No INSERT/UPDATE/DELETE for regular users (service role only via webhooks)

-- =============================================
-- Cashflow Summary RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.get_cashflow_summary(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL,
  _start_date timestamptz DEFAULT NULL,
  _end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _money_in numeric;
  _money_out numeric;
  _prev_money_in numeric;
  _prev_money_out numeric;
  _period_days integer;
  _prev_start timestamptz;
  _prev_end timestamptz;
  _currency text;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get currency
  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT default_currency INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  -- Current period inflow (payments received on invoices)
  SELECT COALESCE(SUM(p.amount), 0) INTO _money_in
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR p.payment_date >= _start_date::date)
    AND (_end_date IS NULL OR p.payment_date <= _end_date::date);

  -- Current period outflow (expenses)
  SELECT COALESCE(SUM(e.amount), 0) INTO _money_out
  FROM expenses e
  WHERE e.business_id = _business_id
    AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR e.expense_date >= _start_date::date)
    AND (_end_date IS NULL OR e.expense_date <= _end_date::date);

  -- Calculate previous period for comparison
  IF _start_date IS NOT NULL AND _end_date IS NOT NULL THEN
    _period_days := EXTRACT(DAY FROM _end_date - _start_date)::integer;
    _prev_end := _start_date;
    _prev_start := _start_date - (_period_days || ' days')::interval;

    SELECT COALESCE(SUM(p.amount), 0) INTO _prev_money_in
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND p.payment_date >= _prev_start::date
      AND p.payment_date < _prev_end::date;

    SELECT COALESCE(SUM(e.amount), 0) INTO _prev_money_out
    FROM expenses e
    WHERE e.business_id = _business_id
      AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id)
      AND e.expense_date >= _prev_start::date
      AND e.expense_date < _prev_end::date;
  ELSE
    _prev_money_in := 0;
    _prev_money_out := 0;
  END IF;

  RETURN jsonb_build_object(
    'money_in', _money_in,
    'money_out', _money_out,
    'net_cashflow', _money_in - _money_out,
    'prev_money_in', _prev_money_in,
    'prev_money_out', _prev_money_out,
    'prev_net_cashflow', _prev_money_in - _prev_money_out,
    'currency', _currency
  );
END;
$$;

-- =============================================
-- Receivables Intelligence RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.get_receivables_intelligence(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _aging jsonb;
  _slow_payers jsonb;
  _currency text;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT default_currency INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  -- Aging buckets on outstanding invoices
  SELECT jsonb_build_object(
    'total_outstanding', COALESCE(SUM(i.total_amount - i.amount_paid), 0),
    'total_overdue', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (WHERE i.due_date < CURRENT_DATE), 0),
    'bucket_0_30', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (
      WHERE i.due_date IS NOT NULL AND CURRENT_DATE - i.due_date BETWEEN 0 AND 30
    ), 0),
    'bucket_31_60', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (
      WHERE i.due_date IS NOT NULL AND CURRENT_DATE - i.due_date BETWEEN 31 AND 60
    ), 0),
    'bucket_61_90', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (
      WHERE i.due_date IS NOT NULL AND CURRENT_DATE - i.due_date BETWEEN 61 AND 90
    ), 0),
    'bucket_90_plus', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (
      WHERE i.due_date IS NOT NULL AND CURRENT_DATE - i.due_date > 90
    ), 0),
    'not_yet_due', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (
      WHERE i.due_date IS NULL OR i.due_date >= CURRENT_DATE
    ), 0),
    'outstanding_count', COUNT(*)
  ) INTO _aging
  FROM invoices i
  WHERE i.business_id = _business_id
    AND i.status IN ('issued', 'sent', 'viewed')
    AND i.total_amount > i.amount_paid
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id);

  -- Top 5 slow-paying clients (avg days from issue to full payment)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY avg_days DESC), '[]'::jsonb) INTO _slow_payers
  FROM (
    SELECT jsonb_build_object(
      'client_id', c.id,
      'client_name', c.name,
      'avg_days_to_pay', ROUND(AVG(EXTRACT(DAY FROM (p_last.last_payment_date - i.issued_at::date))), 1),
      'total_outstanding', COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (WHERE i.status IN ('issued', 'sent', 'viewed')), 0),
      'invoice_count', COUNT(DISTINCT i.id)
    ) AS row_data,
    ROUND(AVG(EXTRACT(DAY FROM (p_last.last_payment_date - i.issued_at::date))), 1) AS avg_days
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    LEFT JOIN LATERAL (
      SELECT MAX(p.payment_date) AS last_payment_date
      FROM payments p WHERE p.invoice_id = i.id
    ) p_last ON true
    WHERE i.business_id = _business_id
      AND i.status IN ('issued', 'sent', 'viewed', 'paid')
      AND i.issued_at IS NOT NULL
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    GROUP BY c.id, c.name
    HAVING COUNT(DISTINCT i.id) >= 1
    LIMIT 5
  ) sub;

  RETURN _aging || jsonb_build_object('slow_payers', _slow_payers, 'currency', _currency);
END;
$$;

-- =============================================
-- Profitability Stats RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.get_profitability_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL,
  _start_date timestamptz DEFAULT NULL,
  _end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _revenue numeric;
  _total_expenses numeric;
  _currency text;
  _monthly_trend jsonb;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT default_currency INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  -- Gross revenue (payments received)
  SELECT COALESCE(SUM(p.amount), 0) INTO _revenue
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR p.payment_date >= _start_date::date)
    AND (_end_date IS NULL OR p.payment_date <= _end_date::date);

  -- Total expenses
  SELECT COALESCE(SUM(e.amount), 0) INTO _total_expenses
  FROM expenses e
  WHERE e.business_id = _business_id
    AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR e.expense_date >= _start_date::date)
    AND (_end_date IS NULL OR e.expense_date <= _end_date::date);

  -- Monthly revenue vs expenses trend (last 12 months)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY month_start), '[]'::jsonb) INTO _monthly_trend
  FROM (
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', COALESCE(_start_date, now() - interval '11 months')),
        date_trunc('month', COALESCE(_end_date, now())),
        '1 month'::interval
      )::date AS month_start
    )
    SELECT jsonb_build_object(
      'month', to_char(m.month_start, 'Mon YY'),
      'revenue', COALESCE((
        SELECT SUM(p.amount) FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE i.business_id = _business_id
          AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
          AND date_trunc('month', p.payment_date::timestamptz) = m.month_start
      ), 0),
      'expenses', COALESCE((
        SELECT SUM(e.amount) FROM expenses e
        WHERE e.business_id = _business_id
          AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id)
          AND date_trunc('month', e.expense_date::timestamptz) = m.month_start
      ), 0)
    ) AS row_data,
    m.month_start
    FROM months m
  ) sub;

  RETURN jsonb_build_object(
    'gross_revenue', _revenue,
    'total_expenses', _total_expenses,
    'net_profit', _revenue - _total_expenses,
    'profit_margin', CASE WHEN _revenue > 0 THEN ROUND(((_revenue - _total_expenses) / _revenue) * 100, 1) ELSE 0 END,
    'monthly_trend', _monthly_trend,
    'currency', _currency
  );
END;
$$;
