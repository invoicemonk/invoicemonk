
-- 1. Backfill user_activity_state for all existing users who don't have a row
INSERT INTO public.user_activity_state (user_id, email_verified, has_business, last_business_created_at, total_invoices, overdue_count, created_at, updated_at)
SELECT
  p.id,
  COALESCE(p.email_verified, false),
  EXISTS (SELECT 1 FROM business_members bm WHERE bm.user_id = p.id),
  (SELECT MAX(b.created_at) FROM businesses b JOIN business_members bm ON bm.business_id = b.id WHERE bm.user_id = p.id),
  COALESCE((
    SELECT COUNT(*)::int FROM invoices i
    JOIN business_members bm ON bm.business_id = i.business_id
    WHERE bm.user_id = p.id AND bm.role = 'owner' AND i.status != 'draft'
  ), 0),
  COALESCE((
    SELECT COUNT(*)::int FROM invoices i
    JOIN business_members bm ON bm.business_id = i.business_id
    WHERE bm.user_id = p.id AND bm.role = 'owner'
      AND i.status IN ('issued', 'sent', 'viewed')
      AND i.due_date < CURRENT_DATE
  ), 0),
  p.created_at,
  now()
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM user_activity_state uas WHERE uas.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Backfill total_invoices for existing users who already have a row but count is wrong
UPDATE public.user_activity_state uas
SET total_invoices = sub.cnt, updated_at = now()
FROM (
  SELECT bm.user_id, COUNT(i.id)::int AS cnt
  FROM business_members bm
  JOIN invoices i ON i.business_id = bm.business_id
  WHERE bm.role = 'owner' AND i.status != 'draft'
  GROUP BY bm.user_id
) sub
WHERE uas.user_id = sub.user_id AND uas.total_invoices != sub.cnt;

-- 3. Backfill overdue_count
UPDATE public.user_activity_state uas
SET overdue_count = sub.cnt, updated_at = now()
FROM (
  SELECT bm.user_id, COUNT(i.id)::int AS cnt
  FROM business_members bm
  JOIN invoices i ON i.business_id = bm.business_id
  WHERE bm.role = 'owner'
    AND i.status IN ('issued', 'sent', 'viewed')
    AND i.due_date < CURRENT_DATE
  GROUP BY bm.user_id
) sub
WHERE uas.user_id = sub.user_id AND uas.overdue_count != sub.cnt;

-- 4. Fix on_invoice_issued_lifecycle trigger to resolve user via business_members
CREATE OR REPLACE FUNCTION public.on_invoice_issued_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  -- Only fire when status changes to a non-draft status
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
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
