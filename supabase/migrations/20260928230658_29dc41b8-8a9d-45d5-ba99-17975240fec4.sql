ALTER TABLE public.lifecycle_events
  ADD COLUMN IF NOT EXISTS product_area text,
  ADD COLUMN IF NOT EXISTS workflow text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system';

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_user_area ON public.lifecycle_events (user_id, product_area, stage, created_at);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_area_stage ON public.lifecycle_events (product_area, stage, created_at);

CREATE POLICY "Platform admins can view all lifecycle events" ON public.lifecycle_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'));

-- Core logger: computes journey stage per user + product area
CREATE OR REPLACE FUNCTION public.log_product_event(
  _user_id uuid, _business_id uuid, _area text, _workflow text, _event text,
  _milestone text DEFAULT 'progress', _metadata jsonb DEFAULT '{}'::jsonb, _source text DEFAULT 'system')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _stage text := _milestone;
BEGIN
  IF _user_id IS NULL OR _area IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM lifecycle_events WHERE user_id=_user_id AND product_area=_area) THEN
    INSERT INTO lifecycle_events(user_id,event_type,metadata,product_area,workflow,stage,business_id,source)
    VALUES (_user_id, 'product.'||_area||'.started', _metadata, _area, _workflow, 'started', _business_id, _source);
  END IF;
  IF _milestone IN ('activated','outcome') AND EXISTS (
    SELECT 1 FROM lifecycle_events WHERE user_id=_user_id AND product_area=_area AND stage=_milestone) THEN
    _stage := 'repeat';
  END IF;
  INSERT INTO lifecycle_events(user_id,event_type,metadata,product_area,workflow,stage,business_id,source)
  VALUES (_user_id, 'product.'||_area||'.'||_event,
          _metadata || jsonb_build_object('milestone',_milestone), _area, _workflow, _stage, _business_id, _source);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_product_event failed: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.log_product_event(uuid,uuid,text,text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;

-- Client-callable wrapper (user-initiated events)
CREATE OR REPLACE FUNCTION public.track_product_event(
  _area text, _workflow text, _event text, _milestone text DEFAULT 'progress',
  _business_id uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _milestone NOT IN ('progress','activated','outcome') THEN _milestone := 'progress'; END IF;
  IF length(_area) > 50 OR length(_event) > 80 OR length(coalesce(_workflow,'')) > 80 THEN RETURN; END IF;
  IF _business_id IS NOT NULL AND NOT public.is_business_member(auth.uid(), _business_id) THEN _business_id := NULL; END IF;
  PERFORM public.log_product_event(auth.uid(), _business_id, _area, _workflow, _event, _milestone, coalesce(_metadata,'{}'::jsonb), 'client');
END $$;
GRANT EXECUTE ON FUNCTION public.track_product_event(text,text,text,text,uuid,jsonb) TO authenticated;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.trg_product_invoices() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wf text := CASE WHEN NEW.kind::text = 'standard' THEN 'standard_invoice' ELSE NEW.kind::text||'_invoice' END;
        m jsonb := jsonb_build_object('invoice_id', NEW.id, 'kind', NEW.kind);
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_product_event(NEW.user_id, NEW.business_id, 'invoicing', wf, 'invoice_drafted', 'progress', m);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'issued' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'invoicing', wf, 'invoice_issued', 'activated', m);
    ELSIF NEW.status = 'sent' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'invoicing', wf, 'invoice_sent', 'outcome', m);
    ELSIF NEW.status = 'viewed' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'invoicing', wf, 'invoice_viewed', 'progress', m);
    ELSIF NEW.status = 'paid' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'payments', 'invoice_payment', 'invoice_paid', 'outcome', m);
    ELSIF NEW.status = 'voided' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'invoicing', wf, 'invoice_voided', 'progress', m);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END $$;
CREATE TRIGGER product_events_invoices AFTER INSERT OR UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trg_product_invoices();

CREATE OR REPLACE FUNCTION public.trg_product_simple() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb := to_jsonb(NEW); uid uuid; biz uuid; inv record;
BEGIN
  uid := coalesce((r->>'user_id')::uuid, (r->>'created_by')::uuid, (r->>'issued_by')::uuid, (r->>'recorded_by')::uuid, auth.uid());
  biz := (r->>'business_id')::uuid;
  IF TG_TABLE_NAME IN ('payments','receipts') AND r ? 'invoice_id' THEN
    SELECT user_id, business_id INTO inv FROM invoices WHERE id = (r->>'invoice_id')::uuid;
    uid := coalesce(uid, inv.user_id); biz := coalesce(biz, inv.business_id);
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'credit_notes' THEN PERFORM log_product_event(uid, biz, 'credit_notes', 'credit_note', 'credit_note_issued', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'payments' THEN PERFORM log_product_event(uid, biz, 'payments', 'record_payment', 'payment_recorded', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'receipts' THEN PERFORM log_product_event(uid, biz, 'receipts', 'payment_receipt', 'receipt_generated', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'clients' THEN PERFORM log_product_event(uid, biz, 'clients', 'client_management', 'client_created', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'vendors' THEN PERFORM log_product_event(uid, biz, 'vendors', 'vendor_management', 'vendor_created', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'products_services' THEN PERFORM log_product_event(uid, biz, 'products_services', 'catalog', 'item_created', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'recurring_expenses' THEN PERFORM log_product_event(uid, biz, 'recurring_expenses', 'recurring_expense', 'recurring_expense_created', 'activated', jsonb_build_object('id',NEW.id));
    WHEN 'export_manifests' THEN PERFORM log_product_event(uid, biz, 'data_export', coalesce(r->>'export_type','export'), 'export_generated', 'outcome', jsonb_build_object('id',NEW.id));
    WHEN 'business_members' THEN
      IF r->>'role' <> 'owner' THEN PERFORM log_product_event(auth.uid(), biz, 'team', 'invite_member', 'team_member_added', 'activated', jsonb_build_object('role',r->>'role')); END IF;
    WHEN 'expenses' THEN
      PERFORM log_product_event(uid, biz, 'expenses', CASE WHEN r->>'receipt_url' IS NOT NULL THEN 'expense_with_receipt' ELSE 'manual_expense' END,
        'expense_recorded', 'activated', jsonb_build_object('id',NEW.id,'category',r->>'category'));
      IF r->>'category' IS NOT NULL AND r->>'receipt_url' IS NOT NULL THEN
        PERFORM log_product_event(uid, biz, 'expenses', 'expense_with_receipt', 'expense_documented', 'outcome', jsonb_build_object('id',NEW.id));
      END IF;
    ELSE NULL;
  END CASE;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END $$;

CREATE TRIGGER product_events_credit_notes AFTER INSERT ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_payments AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_receipts AFTER INSERT ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_clients AFTER INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_vendors AFTER INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_products AFTER INSERT ON public.products_services FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_recurring AFTER INSERT ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_exports AFTER INSERT ON public.export_manifests FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_members AFTER INSERT ON public.business_members FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();
CREATE TRIGGER product_events_expenses AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.trg_product_simple();

CREATE OR REPLACE FUNCTION public.trg_product_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'expense_inbox_items' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM log_product_event(NEW.user_id, NEW.business_id, 'receipt_capture', 'expense_inbox', 'document_uploaded', 'progress', jsonb_build_object('id',NEW.id));
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'approved' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'receipt_capture', 'expense_inbox', 'converted_to_expense', 'outcome', jsonb_build_object('id',NEW.id));
      ELSIF NEW.status = 'failed' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'receipt_capture', 'expense_inbox', 'scan_failed', 'progress', jsonb_build_object('id',NEW.id));
      ELSIF NEW.status = 'rejected' THEN PERFORM log_product_event(NEW.user_id, NEW.business_id, 'receipt_capture', 'expense_inbox', 'document_rejected', 'progress', jsonb_build_object('id',NEW.id));
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'scan_jobs' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'done' THEN
      PERFORM log_product_event(NEW.user_id, NEW.business_id, 'receipt_capture', 'scan_'||NEW.source::text, 'document_scanned', 'activated', jsonb_build_object('id',NEW.id));
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END $$;
CREATE TRIGGER product_events_inbox AFTER INSERT OR UPDATE OF status ON public.expense_inbox_items FOR EACH ROW EXECUTE FUNCTION public.trg_product_capture();
CREATE TRIGGER product_events_scans AFTER UPDATE OF status ON public.scan_jobs FOR EACH ROW EXECUTE FUNCTION public.trg_product_capture();

-- Stated intent
CREATE TABLE public.user_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  intent text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  other_text text,
  source text NOT NULL DEFAULT 'onboarding',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, intent)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_intents TO authenticated;
GRANT ALL ON public.user_intents TO service_role;
ALTER TABLE public.user_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own intents" ON public.user_intents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND length(coalesce(other_text,'')) <= 500);
CREATE POLICY "Platform admins view intents" ON public.user_intents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER update_user_intents_updated_at BEFORE UPDATE ON public.user_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();