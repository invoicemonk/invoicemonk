
-- 1. Auto-receipt trigger on payments
CREATE OR REPLACE FUNCTION public.auto_create_receipt_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM create_receipt_from_payment(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Auto receipt creation failed for payment %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_create_receipt_after_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_receipt_on_payment();

-- 2. Backfill missing receipts for orphaned payments
DO $$
DECLARE
  _pid UUID;
BEGIN
  FOR _pid IN 
    SELECT p.id FROM payments p 
    LEFT JOIN receipts r ON r.payment_id = p.id 
    WHERE r.id IS NULL
  LOOP
    BEGIN
      PERFORM create_receipt_from_payment(_pid);
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Backfill receipt failed for payment %: %', _pid, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 3. Update get_accounting_stats to use payments table for money_in (consistent with profitability)
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

  -- Get currency
  IF _currency_account_id IS NOT NULL THEN
    SELECT currency INTO _currency FROM currency_accounts WHERE id = _currency_account_id AND business_id = _business_id;
  END IF;
  IF _currency IS NULL THEN
    SELECT COALESCE(default_currency, 'NGN') INTO _currency FROM businesses WHERE id = _business_id;
  END IF;

  -- Invoice stats (revenue and outstanding)
  SELECT jsonb_build_object(
    'revenue', COALESCE(SUM(total_amount) FILTER (WHERE status IN ('issued', 'sent', 'viewed', 'paid')), 0),
    'revenue_count', COUNT(*) FILTER (WHERE status IN ('issued', 'sent', 'viewed', 'paid')),
    'outstanding', COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('issued', 'sent', 'viewed') AND total_amount > amount_paid), 0),
    'outstanding_count', COUNT(*) FILTER (WHERE status IN ('issued', 'sent', 'viewed') AND total_amount > amount_paid)
  )
  INTO inv_result
  FROM invoices
  WHERE business_id = _business_id
    AND (_currency_account_id IS NULL OR currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR issued_at >= _date_start)
    AND (_date_end IS NULL OR issued_at <= _date_end);

  -- Money In from payments table (consistent with profitability)
  SELECT COALESCE(SUM(p.amount), 0), COUNT(*)
  INTO _money_in, _money_in_count
  FROM payments p
  JOIN invoices i ON i.id = p.invoice_id
  WHERE i.business_id = _business_id
    AND (_currency_account_id IS NULL OR p.currency_account_id = _currency_account_id)
    AND (_date_start IS NULL OR p.payment_date >= (_date_start)::date)
    AND (_date_end IS NULL OR p.payment_date <= (_date_end)::date);

  -- Expense stats
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
