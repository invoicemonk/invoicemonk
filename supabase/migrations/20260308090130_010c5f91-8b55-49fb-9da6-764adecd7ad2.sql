-- Fix trigger: only increment on transition TO 'issued' status specifically
CREATE OR REPLACE FUNCTION public.on_invoice_issued_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  -- Only fire when status becomes 'issued'
  IF NEW.status != 'issued' THEN
    RETURN NEW;
  END IF;
  -- Skip if already was 'issued' (no actual transition)
  IF TG_OP = 'UPDATE' AND OLD.status = 'issued' THEN
    RETURN NEW;
  END IF;

  -- Resolve the target user: prefer user_id, fall back to business owner
  IF NEW.user_id IS NOT NULL THEN
    _target_user_id := NEW.user_id;
  ELSIF NEW.business_id IS NOT NULL THEN
    SELECT bm.user_id INTO _target_user_id
    FROM business_members bm
    WHERE bm.business_id = NEW.business_id AND bm.role = 'owner'
    LIMIT 1;
  END IF;

  IF _target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Increment total_invoices
  UPDATE user_activity_state
  SET total_invoices = total_invoices + 1, updated_at = now()
  WHERE user_id = _target_user_id;

  RETURN NEW;
END;
$$;

-- Re-backfill total_invoices from actual issued/sent/viewed/paid/overdue invoice counts
UPDATE user_activity_state uas
SET total_invoices = COALESCE(sub.cnt, 0), updated_at = now()
FROM (
  SELECT bm.user_id, COUNT(DISTINCT i.id)::int AS cnt
  FROM business_members bm
  JOIN invoices i ON i.business_id = bm.business_id
  WHERE bm.role = 'owner' AND i.status NOT IN ('draft', 'voided')
  GROUP BY bm.user_id
) sub
WHERE uas.user_id = sub.user_id AND uas.total_invoices != sub.cnt;