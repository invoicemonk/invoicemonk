-- Phase E: Aggregation safety for deposit/final invoices
-- Avoid double-counting deposit + final invoice amounts in dashboards, accounting, receivables.
-- Strategy: when a deposit invoice is "consumed" by a non-draft/non-voided final invoice
-- (i.e., another invoice has parent_invoice_id = deposit.id), exclude the deposit from
-- invoice-based aggregations (revenue, invoiced, outstanding, aging). The final invoice
-- represents the full transaction. Cash payments are unaffected (real money received).

-- 1) get_dashboard_stats: exclude consumed deposits, and for final invoices subtract
--    the linked deposit's amount_paid from the outstanding balance.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL::uuid,
  _date_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _date_end timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  WITH base AS (
    SELECT
      i.*,
      -- Sibling deposit's amount_paid (only for final invoices linked to a deposit)
      COALESCE((
        SELECT d.amount_paid
        FROM invoices d
        WHERE d.id = i.parent_invoice_id
          AND i.kind = 'final'
      ), 0) AS deposit_credit,
      -- Whether this deposit invoice is "consumed" by a non-draft/non-voided final invoice
      EXISTS (
        SELECT 1 FROM invoices c
        WHERE c.parent_invoice_id = i.id
          AND c.kind = 'final'
          AND c.status NOT IN ('draft','voided')
      ) AS deposit_consumed
    FROM invoices i
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (
        _date_start IS NULL
        OR i.status = 'draft'
        OR i.issued_at >= _date_start
      )
      AND (
        _date_end IS NULL
        OR i.status = 'draft'
        OR i.issued_at <= _date_end
      )
  )
  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount_paid) FILTER (
      WHERE status NOT IN ('draft','voided')
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ), 0),
    'total_invoiced', COALESCE(SUM(total_amount) FILTER (
      WHERE status NOT IN ('draft','voided')
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ), 0),
    'outstanding', COALESCE(SUM(GREATEST(total_amount - amount_paid - deposit_credit, 0)) FILTER (
      WHERE status IN ('issued','sent','viewed')
        AND NOT (kind = 'deposit' AND deposit_consumed)
        AND (total_amount - amount_paid - deposit_credit) > 0
    ), 0),
    'outstanding_count', COUNT(*) FILTER (
      WHERE status IN ('issued','sent','viewed')
        AND NOT (kind = 'deposit' AND deposit_consumed)
        AND (total_amount - amount_paid - deposit_credit) > 0
    ),
    'paid_this_month', COALESCE(SUM(amount_paid) FILTER (
      WHERE status NOT IN ('draft','voided')
        AND amount_paid > 0
        AND NOT (kind = 'deposit' AND deposit_consumed)
        AND issued_at >= date_trunc('month', COALESCE(_date_start, now()))
        AND issued_at <= COALESCE(_date_end, (date_trunc('month', now()) + interval '1 month - 1 second'))
    ), 0),
    'paid_this_month_count', COUNT(*) FILTER (
      WHERE status NOT IN ('draft','voided')
        AND amount_paid > 0
        AND NOT (kind = 'deposit' AND deposit_consumed)
        AND issued_at >= date_trunc('month', COALESCE(_date_start, now()))
        AND issued_at <= COALESCE(_date_end, (date_trunc('month', now()) + interval '1 month - 1 second'))
    ),
    'draft_count', COUNT(*) FILTER (WHERE status = 'draft'),
    'currency', _currency
  )
  INTO result
  FROM base;

  RETURN result;
END;
$function$;

-- 2) get_accounting_stats: same exclusion for revenue/outstanding (invoice-based).
--    money_in/money_out remain payment/expense based — unchanged.
CREATE OR REPLACE FUNCTION public.get_accounting_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL::uuid,
  _date_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _date_end timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv_result JSONB;
  _currency TEXT;
  _money_in NUMERIC;
  _money_in_count BIGINT;
  _money_out NUMERIC;
  _expense_count BIGINT;
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

  WITH base AS (
    SELECT
      i.*,
      COALESCE((
        SELECT d.amount_paid FROM invoices d
        WHERE d.id = i.parent_invoice_id AND i.kind = 'final'
      ), 0) AS deposit_credit,
      EXISTS (
        SELECT 1 FROM invoices c
        WHERE c.parent_invoice_id = i.id
          AND c.kind = 'final'
          AND c.status NOT IN ('draft','voided')
      ) AS deposit_consumed
    FROM invoices i
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (_date_start IS NULL OR i.issued_at >= _date_start)
      AND (_date_end IS NULL OR i.issued_at <= _date_end)
  )
  SELECT jsonb_build_object(
    'revenue', COALESCE(SUM(total_amount) FILTER (
      WHERE status IN ('issued','sent','viewed','paid')
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ), 0),
    'revenue_count', COUNT(*) FILTER (
      WHERE status IN ('issued','sent','viewed','paid')
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ),
    'outstanding', COALESCE(SUM(GREATEST(total_amount - amount_paid - deposit_credit, 0)) FILTER (
      WHERE status IN ('issued','sent','viewed')
        AND NOT (kind = 'deposit' AND deposit_consumed)
        AND (total_amount - amount_paid - deposit_credit) > 0
    ), 0),
    'outstanding_count', COUNT(*) FILTER (
      WHERE status IN ('issued','sent','viewed')
        AND NOT (kind = 'deposit' AND deposit_consumed)
        AND (total_amount - amount_paid - deposit_credit) > 0
    )
  )
  INTO inv_result
  FROM base;

  -- Money In from payments (real cash) - unchanged
  SELECT COALESCE(SUM(p.amount), 0), COUNT(*)
  INTO _money_in, _money_in_count
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR p.payment_date >= (_date_start)::date)
    AND (_date_end IS NULL OR p.payment_date <= (_date_end)::date);

  -- Expenses - unchanged
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO _money_out, _expense_count
  FROM expenses
  WHERE business_id = _business_id
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR expense_date >= (_date_start)::date)
    AND (_date_end IS NULL OR expense_date <= (_date_end)::date);

  RETURN inv_result || jsonb_build_object(
    'money_in', _money_in,
    'money_in_count', _money_in_count,
    'money_out', _money_out,
    'expense_count', _expense_count,
    'whats_left', _money_in - _money_out,
    'currency', _currency
  );
END;
$function$;

-- 3) get_due_date_stats: exclude consumed deposits; subtract deposit credit on finals.
CREATE OR REPLACE FUNCTION public.get_due_date_stats(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  WITH base AS (
    SELECT
      i.*,
      COALESCE((
        SELECT d.amount_paid FROM invoices d
        WHERE d.id = i.parent_invoice_id AND i.kind = 'final'
      ), 0) AS deposit_credit,
      EXISTS (
        SELECT 1 FROM invoices c
        WHERE c.parent_invoice_id = i.id
          AND c.kind = 'final'
          AND c.status NOT IN ('draft','voided')
      ) AS deposit_consumed
    FROM invoices i
    WHERE i.business_id = _business_id
      AND i.status IN ('issued','sent','viewed')
      AND i.due_date IS NOT NULL
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
  )
  SELECT jsonb_build_object(
    'overdue_count', COUNT(*) FILTER (
      WHERE due_date < CURRENT_DATE
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ),
    'overdue_amount', COALESCE(SUM(GREATEST(total_amount - amount_paid - deposit_credit, 0)) FILTER (
      WHERE due_date < CURRENT_DATE
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ), 0),
    'upcoming_count', COUNT(*) FILTER (
      WHERE due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + 7
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ),
    'upcoming_amount', COALESCE(SUM(GREATEST(total_amount - amount_paid - deposit_credit, 0)) FILTER (
      WHERE due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + 7
        AND NOT (kind = 'deposit' AND deposit_consumed)
    ), 0),
    'currency', _currency
  )
  INTO result
  FROM base;

  RETURN result;
END;
$function$;

-- 4) get_revenue_trend: exclude consumed deposits from monthly paid totals.
CREATE OR REPLACE FUNCTION public.get_revenue_trend(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL::uuid,
  _months integer DEFAULT 12
)
RETURNS TABLE(month text, revenue numeric, invoice_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - ((_months - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'::interval
    )::date AS month_start
  )
  SELECT
    to_char(m.month_start, 'Mon YY') AS month,
    COALESCE(SUM(i.total_amount), 0) AS revenue,
    COUNT(i.id) AS invoice_count
  FROM months m
  LEFT JOIN invoices i ON
    i.business_id = _business_id
    AND i.status = 'paid'
    AND date_trunc('month', i.issued_at) = m.month_start
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    AND NOT (
      i.kind = 'deposit'
      AND EXISTS (
        SELECT 1 FROM invoices c
        WHERE c.parent_invoice_id = i.id
          AND c.kind = 'final'
          AND c.status NOT IN ('draft','voided')
      )
    )
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$function$;

-- 5) get_receivables_intelligence: exclude consumed deposits, adjust outstanding for final.
CREATE OR REPLACE FUNCTION public.get_receivables_intelligence(
  _business_id uuid,
  _currency_account_id uuid DEFAULT NULL::uuid,
  _start_date date DEFAULT NULL::date,
  _end_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- Aggregates across all non-draft/non-voided invoices, excluding consumed deposits.
  WITH base AS (
    SELECT
      i.*,
      COALESCE((
        SELECT d.amount_paid FROM invoices d
        WHERE d.id = i.parent_invoice_id AND i.kind = 'final'
      ), 0) AS deposit_credit,
      EXISTS (
        SELECT 1 FROM invoices c
        WHERE c.parent_invoice_id = i.id
          AND c.kind = 'final'
          AND c.status NOT IN ('draft','voided')
      ) AS deposit_consumed
    FROM public.invoices i
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (_start_date IS NULL OR i.issue_date >= _start_date)
      AND (_end_date IS NULL OR i.issue_date <= _end_date)
      AND i.status IN ('issued','sent','viewed','paid')
  ), filtered AS (
    SELECT * FROM base
    WHERE NOT (kind = 'deposit' AND deposit_consumed)
  )
  SELECT
    COALESCE(SUM(GREATEST(total_amount - COALESCE(amount_paid,0) - deposit_credit, 0)), 0),
    COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND GREATEST(total_amount - COALESCE(amount_paid,0) - deposit_credit, 0) > 0 THEN GREATEST(total_amount - COALESCE(amount_paid,0) - deposit_credit, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN (due_date >= CURRENT_DATE OR due_date IS NULL) AND GREATEST(total_amount - COALESCE(amount_paid,0) - deposit_credit, 0) > 0 THEN GREATEST(total_amount - COALESCE(amount_paid,0) - deposit_credit, 0) ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND GREATEST(total_amount - COALESCE(amount_paid,0) - deposit_credit, 0) > 0),
    COUNT(*),
    COALESCE(SUM(COALESCE(amount_paid,0) + deposit_credit), 0),
    COALESCE(SUM(total_amount), 0)
  INTO v_total_receivables, v_overdue_amount, v_current_amount, v_overdue_count, v_invoice_count, v_total_collected, v_total_invoiced
  FROM filtered;

  -- Average days to pay
  SELECT COALESCE(AVG(p.payment_date::date - i.issue_date::date), 0)
  INTO v_avg_days_to_pay
  FROM public.invoices i
  JOIN public.payments p ON p.invoice_id = i.id
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
    AND (_start_date IS NULL OR i.issue_date >= _start_date)
    AND (_end_date IS NULL OR i.issue_date <= _end_date)
    AND i.status IN ('issued','sent','viewed','paid')
    AND p.payment_date IS NOT NULL;

  v_collection_rate_pct := CASE WHEN v_total_invoiced > 0 THEN ROUND((v_total_collected / v_total_invoiced) * 100, 1) ELSE 0 END;

  -- Top debtors
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
  INTO v_top_debtors
  FROM (
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      COUNT(i.id)::int AS invoice_count,
      SUM(GREATEST(
        i.total_amount - COALESCE(i.amount_paid,0)
        - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
        0
      )) AS outstanding_amount,
      MAX(i.due_date) AS oldest_due_date
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (_start_date IS NULL OR i.issue_date >= _start_date)
      AND (_end_date IS NULL OR i.issue_date <= _end_date)
      AND i.status IN ('issued','sent','viewed')
      AND NOT (
        i.kind = 'deposit'
        AND EXISTS (
          SELECT 1 FROM invoices cc
          WHERE cc.parent_invoice_id = i.id
            AND cc.kind = 'final'
            AND cc.status NOT IN ('draft','voided')
        )
      )
      AND GREATEST(
        i.total_amount - COALESCE(i.amount_paid,0)
        - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
        0
      ) > 0
    GROUP BY c.id, c.name
    ORDER BY outstanding_amount DESC
    LIMIT 10
  ) x;

  -- Slow payers
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
  INTO v_slow_payers
  FROM (
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      ROUND(AVG(p.payment_date::date - i.issue_date::date), 1) AS avg_days_to_pay,
      COUNT(DISTINCT i.id)::int AS invoice_count,
      SUM(CASE WHEN i.status IN ('issued','sent','viewed') THEN GREATEST(
        i.total_amount - COALESCE(i.amount_paid,0)
        - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
        0
      ) ELSE 0 END) AS outstanding_amount,
      SUM(COALESCE(i.amount_paid,0)) AS total_paid
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    JOIN public.payments p ON p.invoice_id = i.id
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND (_start_date IS NULL OR i.issue_date >= _start_date)
      AND (_end_date IS NULL OR i.issue_date <= _end_date)
      AND i.status IN ('issued','sent','viewed','paid')
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
      'days_1_30', (
        SELECT COALESCE(SUM(GREATEST(
          i.total_amount - COALESCE(i.amount_paid,0)
          - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
          0
        )), 0)
        FROM invoices i
        WHERE i.business_id=_business_id
          AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id)
          AND (_start_date IS NULL OR i.issue_date>=_start_date)
          AND (_end_date IS NULL OR i.issue_date<=_end_date)
          AND i.status IN ('issued','sent','viewed')
          AND i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - 30
          AND NOT (i.kind='deposit' AND EXISTS (SELECT 1 FROM invoices cc WHERE cc.parent_invoice_id=i.id AND cc.kind='final' AND cc.status NOT IN ('draft','voided')))
      ),
      'days_31_60', (
        SELECT COALESCE(SUM(GREATEST(
          i.total_amount - COALESCE(i.amount_paid,0)
          - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
          0
        )), 0)
        FROM invoices i
        WHERE i.business_id=_business_id
          AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id)
          AND (_start_date IS NULL OR i.issue_date>=_start_date)
          AND (_end_date IS NULL OR i.issue_date<=_end_date)
          AND i.status IN ('issued','sent','viewed')
          AND i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60
          AND NOT (i.kind='deposit' AND EXISTS (SELECT 1 FROM invoices cc WHERE cc.parent_invoice_id=i.id AND cc.kind='final' AND cc.status NOT IN ('draft','voided')))
      ),
      'days_61_90', (
        SELECT COALESCE(SUM(GREATEST(
          i.total_amount - COALESCE(i.amount_paid,0)
          - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
          0
        )), 0)
        FROM invoices i
        WHERE i.business_id=_business_id
          AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id)
          AND (_start_date IS NULL OR i.issue_date>=_start_date)
          AND (_end_date IS NULL OR i.issue_date<=_end_date)
          AND i.status IN ('issued','sent','viewed')
          AND i.due_date < CURRENT_DATE - 60 AND i.due_date >= CURRENT_DATE - 90
          AND NOT (i.kind='deposit' AND EXISTS (SELECT 1 FROM invoices cc WHERE cc.parent_invoice_id=i.id AND cc.kind='final' AND cc.status NOT IN ('draft','voided')))
      ),
      'days_90_plus', (
        SELECT COALESCE(SUM(GREATEST(
          i.total_amount - COALESCE(i.amount_paid,0)
          - COALESCE((SELECT d.amount_paid FROM invoices d WHERE d.id = i.parent_invoice_id AND i.kind = 'final'), 0),
          0
        )), 0)
        FROM invoices i
        WHERE i.business_id=_business_id
          AND (_currency_account_id IS NULL OR i.currency_account_id=_currency_account_id)
          AND (_start_date IS NULL OR i.issue_date>=_start_date)
          AND (_end_date IS NULL OR i.issue_date<=_end_date)
          AND i.status IN ('issued','sent','viewed')
          AND i.due_date < CURRENT_DATE - 90
          AND NOT (i.kind='deposit' AND EXISTS (SELECT 1 FROM invoices cc WHERE cc.parent_invoice_id=i.id AND cc.kind='final' AND cc.status NOT IN ('draft','voided')))
      )
    ),
    'top_debtors', v_top_debtors,
    'slow_payers', v_slow_payers
  );
END;
$function$;