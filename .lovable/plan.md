

# Fix Lifecycle Campaign B Targeting & Email Logo

## Problems

### 1. Campaign B sent to users who already have invoices
The `on_invoice_issued_lifecycle` trigger (latest version) increments `total_invoices` on **every** status transition away from draft — not just the first one. So an invoice going draft → issued → sent → viewed → paid adds **4** to the counter, but more critically, the trigger only fires correctly going forward. The backfill migration ran once but any users whose `total_invoices` was already wrong before the backfill (or who had invoices counted by the old trigger using `user_id` instead of business owner lookup) may still have `total_invoices = 0` in `user_activity_state`, making Campaign B target them incorrectly.

**Fix**: Two changes needed:
- **Fix the trigger** to only increment on the transition TO `issued` (matching original intent), not on every non-draft status change
- **Re-run a backfill** to correct `total_invoices` for all users based on actual invoice counts

### 2. Teal logo on teal background is invisible
The `emailWrapper` function uses `invoicemonk-logo.png` (teal-colored) against a teal gradient background. Need a white version of the logo.

**Fix**: 
- Add a white logo file (`invoicemonk-logo-white.png`) to the `public/` directory — will need the user to provide this asset, OR we can skip the logo on the teal header and just show the text "InvoiceMonk" in white
- Update the `emailWrapper` in `process-lifecycle-campaigns/index.ts` to use the white logo URL

## Changes

### File: Database migration (SQL)
```sql
-- Fix trigger: only increment on transition TO 'issued'
CREATE OR REPLACE FUNCTION public.on_invoice_issued_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _target_user_id uuid;
BEGIN
  IF NEW.status != 'issued' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'issued' THEN RETURN NEW; END IF;
  -- resolve user via business owner...
  -- increment total_invoices
END;
$$;

-- Re-backfill total_invoices from actual data
UPDATE user_activity_state uas
SET total_invoices = sub.cnt, updated_at = now()
FROM (
  SELECT bm.user_id, COUNT(DISTINCT i.id)::int AS cnt
  FROM business_members bm
  JOIN invoices i ON i.business_id = bm.business_id
  WHERE bm.role = 'owner' AND i.status NOT IN ('draft', 'voided')
  GROUP BY bm.user_id
) sub
WHERE uas.user_id = sub.user_id AND uas.total_invoices != sub.cnt;
```

### File: `supabase/functions/process-lifecycle-campaigns/index.ts`
- In `emailWrapper` (line 55): Replace the `<img>` tag with a plain text "InvoiceMonk" styled in white, bold, since no white logo asset exists. Alternatively, if the user can provide a white logo PNG, use that URL instead.
- Fallback approach: Remove the logo image entirely from the teal header and rely on the styled text `<h1>` which is already white.

### Summary
| Change | File |
|--------|------|
| Fix trigger to only fire on → issued | Migration SQL |
| Re-backfill total_invoices | Migration SQL |
| Replace teal logo with white text in email header | process-lifecycle-campaigns/index.ts |

