
-- ============================================================
-- INFRASTRUCTURE HARDENING: Combined Migration
-- 1. RLS Policy Consolidation
-- 2. Invoice Numbering Function
-- 3. Server-Side Stats Functions
-- ============================================================

-- ============================================================
-- 1. RLS POLICY CONSOLIDATION
-- ============================================================

-- === clients: drop duplicate SELECT ===
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;

-- === payments: drop less restrictive INSERT (keep the one checking status) ===
DROP POLICY IF EXISTS "Users can record payments" ON public.payments;

-- === invoices: drop superset UPDATE (keep draft + payment-fields-on-issued) ===
DROP POLICY IF EXISTS "Users can update their invoices" ON public.invoices;

-- === notifications: drop duplicates ===
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- === business_members: drop duplicate SELECT ===
DROP POLICY IF EXISTS "Members can view their business memberships" ON public.business_members;

-- === businesses: drop duplicate INSERT and UPDATE and SELECT ===
DROP POLICY IF EXISTS "Users can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Business admins can update business" ON public.businesses;
DROP POLICY IF EXISTS "Users can view businesses they belong to" ON public.businesses;

-- === invoice_items: drop duplicates ===
DROP POLICY IF EXISTS "Users can manage draft invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete draft invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update draft invoice items" ON public.invoice_items;

-- ============================================================
-- 2. INVOICE NUMBERING FUNCTION
-- ============================================================

-- Backfill next_invoice_number for existing businesses
DO $$
DECLARE
  biz RECORD;
  max_num INT;
BEGIN
  FOR biz IN SELECT id, invoice_prefix FROM public.businesses LOOP
    SELECT COALESCE(MAX(
      CASE 
        WHEN invoice_number ~ '\d+$' 
        THEN (regexp_match(invoice_number, '(\d+)$'))[1]::int 
        ELSE 0 
      END
    ), 0) + 1
    INTO max_num
    FROM public.invoices
    WHERE business_id = biz.id;
    
    UPDATE public.businesses 
    SET next_invoice_number = GREATEST(COALESCE(next_invoice_number, 1), max_num)
    WHERE id = biz.id;
  END LOOP;
END $$;

-- Create atomic invoice number generator
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prefix TEXT;
  _next INT;
BEGIN
  -- Verify caller is a member of the business
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this business';
  END IF;

  -- Atomically increment and get the next number
  UPDATE businesses
  SET next_invoice_number = COALESCE(next_invoice_number, 1) + 1
  WHERE id = _business_id
  RETURNING COALESCE(invoice_prefix, 'INV'), next_invoice_number - 1
  INTO _prefix, _next;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found: %', _business_id;
  END IF;

  RETURN _prefix || '-' || LPAD(_next::text, 4, '0');
END;
$$;

-- ============================================================
-- 3. SERVER-SIDE STATS FUNCTIONS
-- ============================================================

-- Dashboard stats function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
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
  result JSONB;
  _currency TEXT;
BEGIN
  -- Verify caller access
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get currency from currency account
  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT COALESCE(default_currency, 'NGN') INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount_paid) FILTER (WHERE status NOT IN ('draft', 'voided')), 0),
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

-- Accounting stats function
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
  exp_result JSONB;
  _currency TEXT;
  _money_in NUMERIC;
  _money_out NUMERIC;
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
  INTO _money_out, exp_result
  FROM expenses
  WHERE business_id = _business_id
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR expense_date >= (_date_start)::date)
    AND (_date_end IS NULL OR expense_date <= (_date_end)::date);

  RETURN inv_result || jsonb_build_object(
    'money_out', _money_out,
    'expense_count', exp_result,
    'whats_left', _money_in - _money_out,
    'currency', _currency
  );
END;
$$;

-- Revenue trend function
CREATE OR REPLACE FUNCTION public.get_revenue_trend(
  _business_id UUID,
  _currency_account_id UUID DEFAULT NULL,
  _months INT DEFAULT 12
)
RETURNS TABLE(month TEXT, revenue NUMERIC, invoice_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _currency TEXT;
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
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$;

-- Due date stats function
CREATE OR REPLACE FUNCTION public.get_due_date_stats(
  _business_id UUID,
  _currency_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'overdue_count', COUNT(*) FILTER (WHERE due_date < CURRENT_DATE),
    'overdue_amount', COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date < CURRENT_DATE), 0),
    'upcoming_count', COUNT(*) FILTER (WHERE due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + 7),
    'upcoming_amount', COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + 7), 0),
    'currency', _currency
  )
  INTO result
  FROM invoices
  WHERE business_id = _business_id
    AND status IN ('issued', 'sent', 'viewed')
    AND due_date IS NOT NULL
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id);

  RETURN result;
END;
$$;

-- Expenses by category function
CREATE OR REPLACE FUNCTION public.get_expenses_by_category(
  _business_id UUID,
  _currency_account_id UUID DEFAULT NULL,
  _date_start TIMESTAMPTZ DEFAULT NULL,
  _date_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(category TEXT, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT e.category, COALESCE(SUM(e.amount), 0) AS amount
  FROM expenses e
  WHERE e.business_id = _business_id
    AND (_currency_account_id IS NULL OR e.currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR e.expense_date >= (_date_start)::date)
    AND (_date_end IS NULL OR e.expense_date <= (_date_end)::date)
  GROUP BY e.category
  ORDER BY amount DESC;
END;
$$;
