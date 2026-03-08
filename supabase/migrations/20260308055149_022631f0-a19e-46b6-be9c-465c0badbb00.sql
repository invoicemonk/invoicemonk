CREATE OR REPLACE FUNCTION public.on_invoice_created_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  IF NEW.status = 'draft' THEN
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