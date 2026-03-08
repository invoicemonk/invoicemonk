

# Fix: Draft Invoice Creation Fails Due to NULL user_id in Lifecycle Trigger

## Problem

When creating an invoice, the database trigger `on_invoice_created_lifecycle` fires and tries to insert a row into `lifecycle_events` using `NEW.user_id`. Since all business invoices have `user_id = NULL`, this violates the NOT NULL constraint on `lifecycle_events.user_id`, causing the entire invoice creation to fail.

This is the same root cause as the issued-invoice trigger that was fixed earlier — the draft-creation trigger was missed.

## Solution

Create a migration that replaces `on_invoice_created_lifecycle` with the same owner-resolution pattern used in the fixed `on_invoice_issued_lifecycle` trigger:

### New migration file

```sql
CREATE OR REPLACE FUNCTION public.on_invoice_created_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  IF NEW.status = 'draft' THEN
    -- Resolve user: prefer user_id, fall back to business owner
    IF NEW.user_id IS NOT NULL THEN
      _target_user_id := NEW.user_id;
    ELSIF NEW.business_id IS NOT NULL THEN
      SELECT bm.user_id INTO _target_user_id
      FROM business_members bm
      WHERE bm.business_id = NEW.business_id AND bm.role = 'owner'
      LIMIT 1;
    END IF;

    IF _target_user_id IS NOT NULL THEN
      INSERT INTO lifecycle_events (user_id, event_type, metadata)
      VALUES (_target_user_id, 'draft_created',
        jsonb_build_object('invoice_id', NEW.id, 'business_id', NEW.business_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

Single new migration file — no other changes needed. The trigger name and binding remain the same (just replacing the function body).

