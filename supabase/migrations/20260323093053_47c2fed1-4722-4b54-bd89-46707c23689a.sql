CREATE OR REPLACE FUNCTION public.get_receivables_intelligence(_business_id uuid, _currency_account_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_outstanding NUMERIC := 0;
  total_overdue NUMERIC := 0;
  aging_buckets JSONB;
  slow_payers JSONB;
BEGIN
  IF NOT is_business_member(auth.uid(), _business_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(SUM(total_amount - amount_paid), 0)
  INTO total_outstanding
  FROM invoices
  WHERE business_id = _business_id
    AND status IN ('issued', 'viewed', 'overdue')
    AND total_amount > amount_paid
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id);

  SELECT COALESCE(SUM(total_amount - amount_paid), 0)
  INTO total_overdue
  FROM invoices
  WHERE business_id = _business_id
    AND status IN ('issued', 'viewed', 'overdue')
    AND total_amount > amount_paid
    AND due_date < CURRENT_DATE
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id);

  SELECT jsonb_build_object(
    'current', COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN total_amount - amount_paid ELSE 0 END), 0),
    'days_1_30', COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30 THEN total_amount - amount_paid ELSE 0 END), 0),
    'days_31_60', COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN total_amount - amount_paid ELSE 0 END), 0),
    'days_61_90', COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 60 AND due_date >= CURRENT_DATE - 90 THEN total_amount - amount_paid ELSE 0 END), 0),
    'days_90_plus', COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 90 THEN total_amount - amount_paid ELSE 0 END), 0)
  )
  INTO aging_buckets
  FROM invoices
  WHERE business_id = _business_id
    AND status IN ('issued', 'viewed', 'overdue')
    AND total_amount > amount_paid
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id);

  SELECT COALESCE(jsonb_agg(sp), '[]'::jsonb)
  INTO slow_payers
  FROM (
    SELECT 
      c.name AS client_name,
      c.id AS client_id,
      ROUND(AVG(EXTRACT(EPOCH FROM (p.payment_date::timestamp - i.issued_at)) / 86400))::integer AS avg_days_to_pay,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(
        CASE WHEN i.status IN ('issued', 'viewed', 'overdue') AND i.total_amount > i.amount_paid 
        THEN i.total_amount - i.amount_paid ELSE 0 END
      ), 0) AS outstanding_amount
    FROM clients c
    JOIN invoices i ON i.client_id = c.id
    LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.business_id = _business_id
      AND (_currency_account_id IS NULL OR i.currency_account_id = _currency_account_id)
      AND p.payment_date IS NOT NULL
    GROUP BY c.id, c.name
    HAVING AVG(EXTRACT(EPOCH FROM (p.payment_date::timestamp - i.issued_at)) / 86400) > 0
    ORDER BY avg_days_to_pay DESC
    LIMIT 5
  ) sp;

  result := jsonb_build_object(
    'total_outstanding', total_outstanding,
    'overdue_amount', total_overdue,
    'aging', aging_buckets,
    'slow_payers', slow_payers,
    'invoice_count', (
      SELECT COUNT(*)
      FROM invoices
      WHERE business_id = _business_id
        AND status IN ('issued', 'viewed', 'overdue')
        AND total_amount > amount_paid
        AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    )
  );

  RETURN result;
END;
$$;