
DROP FUNCTION IF EXISTS public.get_receivables_intelligence(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_receivables_intelligence(
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
  v_total_receivables numeric := 0;
  v_overdue_amount numeric := 0;
  v_current_amount numeric := 0;
  v_total_collected numeric := 0;
  v_total_invoiced numeric := 0;
  v_overdue_count int := 0;
  v_invoice_count int := 0;
  v_avg_days_to_pay numeric := 0;
  v_collection_rate_pct numeric := 0;
  v_top_debtors jsonb := '[]'::jsonb;
  v_slow_payers jsonb := '[]'::jsonb;
BEGIN
  -- Aggregates across all non-draft, non-voided invoices
  SELECT
    COALESCE(SUM(GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0)), 0),
    COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE AND GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) > 0 THEN GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN (i.due_date >= CURRENT_DATE OR i.due_date IS NULL) AND GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) > 0 THEN GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) > 0),
    COUNT(*),
    COALESCE(SUM(COALESCE(i.amount_paid, 0)), 0),
    COALESCE(SUM(i.total_amount), 0)
  INTO v_total_receivables, v_overdue_amount, v_current_amount, v_overdue_count, v_invoice_count, v_total_collected, v_total_invoiced
  FROM public.invoices i
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR i.issue_date >= _start_date)
    AND (_end_date IS NULL OR i.issue_date <= _end_date)
    AND i.status IN ('issued', 'sent', 'viewed', 'paid');

  -- Average days to pay (only invoices with payments)
  SELECT COALESCE(AVG(p.payment_date::date - i.issue_date::date), 0)
  INTO v_avg_days_to_pay
  FROM public.invoices i
  JOIN public.payments p ON p.invoice_id = i.id
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR i.issue_date >= _start_date)
    AND (_end_date IS NULL OR i.issue_date <= _end_date)
    AND i.status IN ('issued', 'sent', 'viewed', 'paid')
    AND p.payment_date IS NOT NULL;

  v_collection_rate_pct := CASE WHEN v_total_invoiced > 0 THEN ROUND((v_total_collected / v_total_invoiced) * 100, 1) ELSE 0 END;

  -- Top debtors (only outstanding)
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
  INTO v_top_debtors
  FROM (
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      COUNT(i.id)::int AS invoice_count,
      SUM(GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0)) AS outstanding_amount,
      MAX(i.due_date) AS oldest_due_date
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (_start_date IS NULL OR i.issue_date >= _start_date)
      AND (_end_date IS NULL OR i.issue_date <= _end_date)
      AND i.status IN ('issued', 'sent', 'viewed')
      AND GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) > 0
    GROUP BY c.id, c.name
    ORDER BY outstanding_amount DESC
    LIMIT 10
  ) x;

  -- Slow payers (includes paid invoices)
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
  INTO v_slow_payers
  FROM (
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      ROUND(AVG(p.payment_date::date - i.issue_date::date), 1) AS avg_days_to_pay,
      COUNT(DISTINCT i.id)::int AS invoice_count,
      SUM(CASE WHEN i.status IN ('issued', 'sent', 'viewed') THEN GREATEST(i.total_amount - COALESCE(i.amount_paid, 0), 0) ELSE 0 END) AS outstanding_amount,
      SUM(COALESCE(i.amount_paid, 0)) AS total_paid
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    JOIN public.payments p ON p.invoice_id = i.id
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (_start_date IS NULL OR i.issue_date >= _start_date)
      AND (_end_date IS NULL OR i.issue_date <= _end_date)
      AND i.status IN ('issued', 'sent', 'viewed', 'paid')
      AND p.payment_date IS NOT NULL
    GROUP BY c.id, c.name
    ORDER BY avg_days_to_pay DESC
    LIMIT 10
  ) x;

  RETURN jsonb_build_object(
    'total_outstanding', v_total_receivables,
    'overdue_amount', v_overdue_amount,
    'current_amount', v_current_amount,
    'invoice_count', v_invoice_count,
    'overdue_count', v_overdue_count,
    'avg_days_to_pay', v_avg_days_to_pay,
    'collection_rate_pct', v_collection_rate_pct,
    'total_collected', v_total_collected,
    'total_invoiced', v_total_invoiced,
    'aging', jsonb_build_object(
      'current', v_current_amount,
      'days_1_30', (SELECT COALESCE(SUM(GREATEST(i.total_amount - COALESCE(i.amount_paid,0),0)),0) FROM invoices i WHERE i.business_id=_business_id AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id) AND (_start_date IS NULL OR i.issue_date>=_start_date) AND (_end_date IS NULL OR i.issue_date<=_end_date) AND i.status IN ('issued','sent','viewed') AND i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - 30),
      'days_31_60', (SELECT COALESCE(SUM(GREATEST(i.total_amount - COALESCE(i.amount_paid,0),0)),0) FROM invoices i WHERE i.business_id=_business_id AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id) AND (_start_date IS NULL OR i.issue_date>=_start_date) AND (_end_date IS NULL OR i.issue_date<=_end_date) AND i.status IN ('issued','sent','viewed') AND i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60),
      'days_61_90', (SELECT COALESCE(SUM(GREATEST(i.total_amount - COALESCE(i.amount_paid,0),0)),0) FROM invoices i WHERE i.business_id=_business_id AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id) AND (_start_date IS NULL OR i.issue_date>=_start_date) AND (_end_date IS NULL OR i.issue_date<=_end_date) AND i.status IN ('issued','sent','viewed') AND i.due_date < CURRENT_DATE - 60 AND i.due_date >= CURRENT_DATE - 90),
      'days_90_plus', (SELECT COALESCE(SUM(GREATEST(i.total_amount - COALESCE(i.amount_paid,0),0)),0) FROM invoices i WHERE i.business_id=_business_id AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id) AND (_start_date IS NULL OR i.issue_date>=_start_date) AND (_end_date IS NULL OR i.issue_date<=_end_date) AND i.status IN ('issued','sent','viewed') AND i.due_date < CURRENT_DATE - 90)
    ),
    'top_debtors', v_top_debtors,
    'slow_payers', v_slow_payers
  );
END;
$$;
