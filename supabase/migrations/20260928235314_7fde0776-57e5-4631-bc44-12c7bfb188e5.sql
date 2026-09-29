CREATE UNIQUE INDEX IF NOT EXISTS user_intents_one_primary_per_user
  ON public.user_intents(user_id) WHERE is_primary;

CREATE OR REPLACE FUNCTION public.trg_product_simple()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb := to_jsonb(NEW); uid uuid; biz uuid; inv record;
BEGIN
  uid := coalesce((r->>'user_id')::uuid, (r->>'created_by')::uuid, (r->>'issued_by')::uuid, (r->>'recorded_by')::uuid, (r->>'actor_id')::uuid, auth.uid());
  biz := (r->>'business_id')::uuid;
  IF TG_TABLE_NAME IN ('payments','receipts') AND r ? 'invoice_id' THEN
    SELECT user_id, business_id INTO inv FROM invoices WHERE id = (r->>'invoice_id')::uuid;
    uid := coalesce(uid, inv.user_id); biz := coalesce(biz, inv.business_id);
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'credit_notes' THEN PERFORM log_product_event(uid,biz,'credit_notes','credit_note','credit_note_issued','activated',jsonb_build_object('id',NEW.id));
    WHEN 'payments' THEN PERFORM log_product_event(uid,biz,'payments','record_payment','payment_recorded','activated',jsonb_build_object('id',NEW.id));
    WHEN 'receipts' THEN PERFORM log_product_event(uid,biz,'receipts','payment_receipt','receipt_generated','activated',jsonb_build_object('id',NEW.id));
    WHEN 'clients' THEN PERFORM log_product_event(uid,biz,'clients','client_management','client_created','activated',jsonb_build_object('id',NEW.id));
    WHEN 'vendors' THEN PERFORM log_product_event(uid,biz,'vendors','vendor_management','vendor_created','activated',jsonb_build_object('id',NEW.id));
    WHEN 'products_services' THEN PERFORM log_product_event(uid,biz,'products_services','catalog','item_created','activated',jsonb_build_object('id',NEW.id));
    WHEN 'recurring_expenses' THEN PERFORM log_product_event(uid,biz,'recurring_expenses','recurring_expense','recurring_expense_created','activated',jsonb_build_object('id',NEW.id));
    WHEN 'export_manifests' THEN PERFORM log_product_event(uid,biz,'data_export',coalesce(r->>'export_type','export'),'export_generated','outcome',jsonb_build_object('id',NEW.id));
    WHEN 'business_members' THEN IF r->>'role' <> 'owner' THEN PERFORM log_product_event(coalesce(uid,auth.uid()),biz,'team','invite_member','team_member_added','activated',jsonb_build_object('role',r->>'role')); END IF;
    WHEN 'expenses' THEN
      PERFORM log_product_event(uid,biz,'expenses',CASE WHEN r->>'receipt_url' IS NOT NULL THEN 'expense_with_receipt' ELSE 'manual_expense' END,'expense_recorded','activated',jsonb_build_object('id',NEW.id,'category',r->>'category'));
      IF r->>'category' IS NOT NULL AND r->>'receipt_url' IS NOT NULL THEN PERFORM log_product_event(uid,biz,'expenses','expense_with_receipt','expense_documented','outcome',jsonb_build_object('id',NEW.id)); END IF;
    ELSE NULL;
  END CASE;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'trg_product_simple failed: %', SQLERRM; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.trg_product_simple() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_product_regulatory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  SELECT user_id INTO uid FROM public.invoices WHERE id = NEW.invoice_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_product_event(uid,NEW.business_id,'e_invoicing','regulator_submission','submission_created','activated',jsonb_build_object('id',NEW.id),'trigger');
  ELSIF NEW.submission_status IS DISTINCT FROM OLD.submission_status THEN
    IF NEW.submission_status = 'accepted' THEN
      PERFORM public.log_product_event(uid,NEW.business_id,'e_invoicing','regulator_submission','submission_accepted','outcome',jsonb_build_object('id',NEW.id),'trigger');
    ELSIF NEW.submission_status IN ('rejected','failed') THEN
      PERFORM public.log_product_event(uid,NEW.business_id,'e_invoicing','regulator_submission','submission_failed','progress',jsonb_build_object('id',NEW.id,'status',NEW.submission_status),'trigger');
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'trg_product_regulatory failed: %', SQLERRM; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.trg_product_regulatory() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS product_regulatory_capture ON public.regulator_submissions;
CREATE TRIGGER product_regulatory_capture AFTER INSERT OR UPDATE OF submission_status ON public.regulator_submissions FOR EACH ROW EXECUTE FUNCTION public.trg_product_regulatory();

CREATE TABLE public.product_activation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid,
  product_area text NOT NULL,
  workflow text,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','activated','outcome','repeat','inactive','abandoned')),
  started_at timestamptz NOT NULL,
  activated_at timestamptz,
  outcome_at timestamptz,
  repeated_at timestamptz,
  last_active_at timestamptz NOT NULL,
  stopped_step text,
  inactive_after_days integer NOT NULL DEFAULT 14,
  abandoned_after_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (user_id,business_id,product_area)
);
GRANT SELECT ON public.product_activation TO authenticated;
GRANT ALL ON public.product_activation TO service_role;
ALTER TABLE public.product_activation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own product activation" ON public.product_activation FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins view product activation" ON public.product_activation FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'platform_admin'));
CREATE INDEX product_activation_area_status_idx ON public.product_activation(product_area,status,last_active_at DESC);
CREATE INDEX product_activation_business_idx ON public.product_activation(business_id,last_active_at DESC);

CREATE OR REPLACE FUNCTION public.sync_product_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE milestone text := coalesce(NEW.metadata->>'milestone',NEW.stage); current_status text;
BEGIN
  IF NEW.product_area IS NULL OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  current_status := CASE WHEN NEW.stage='repeat' THEN 'repeat' WHEN milestone='outcome' THEN 'outcome' WHEN milestone='activated' THEN 'activated' ELSE 'started' END;
  INSERT INTO public.product_activation(user_id,business_id,product_area,workflow,status,started_at,activated_at,outcome_at,repeated_at,last_active_at,stopped_step)
  VALUES(NEW.user_id,NEW.business_id,NEW.product_area,NEW.workflow,current_status,NEW.created_at,
    CASE WHEN milestone='activated' THEN NEW.created_at END, CASE WHEN milestone='outcome' THEN NEW.created_at END,
    CASE WHEN NEW.stage='repeat' THEN NEW.created_at END,NEW.created_at,NEW.event_type)
  ON CONFLICT (user_id,business_id,product_area) DO UPDATE SET
    workflow=coalesce(EXCLUDED.workflow,product_activation.workflow),
    status=CASE
      WHEN EXCLUDED.status='repeat' THEN 'repeat'
      WHEN EXCLUDED.status='outcome' AND product_activation.status NOT IN ('repeat') THEN 'outcome'
      WHEN EXCLUDED.status='activated' AND product_activation.status IN ('started','inactive','abandoned') THEN 'activated'
      ELSE product_activation.status END,
    activated_at=coalesce(product_activation.activated_at,EXCLUDED.activated_at),
    outcome_at=coalesce(product_activation.outcome_at,EXCLUDED.outcome_at),
    repeated_at=coalesce(EXCLUDED.repeated_at,product_activation.repeated_at),
    last_active_at=EXCLUDED.last_active_at,stopped_step=EXCLUDED.stopped_step,updated_at=now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_product_activation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lifecycle_sync_product_activation AFTER INSERT ON public.lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.sync_product_activation();

CREATE OR REPLACE FUNCTION public.evaluate_product_abandonment()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
  UPDATE public.product_activation SET status=CASE WHEN last_active_at < now()-(abandoned_after_days||' days')::interval THEN 'abandoned' ELSE 'inactive' END,updated_at=now()
  WHERE status IN ('started','activated','inactive') AND last_active_at < now()-(inactive_after_days||' days')::interval;
  GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.evaluate_product_abandonment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_product_abandonment() TO service_role;

CREATE TABLE public.product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  product_area text NOT NULL,
  workflow text,
  activation_id uuid REFERENCES public.product_activation(id) ON DELETE SET NULL,
  prompt_reason text NOT NULL,
  response text,
  alternative_tool text,
  dismissed boolean NOT NULL DEFAULT false,
  prompted_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;
ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own product feedback" ON public.product_feedback FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users create own product feedback" ON public.product_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id AND public.is_business_member(auth.uid(),business_id));
CREATE POLICY "Users update own product feedback" ON public.product_feedback FOR UPDATE TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id AND public.is_business_member(auth.uid(),business_id));
CREATE POLICY "Admins view product feedback" ON public.product_feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'platform_admin'));
CREATE INDEX product_feedback_area_created_idx ON public.product_feedback(product_area,created_at DESC);
CREATE INDEX product_feedback_user_prompt_idx ON public.product_feedback(user_id,prompted_at DESC);
CREATE TRIGGER update_product_feedback_updated_at BEFORE UPDATE ON public.product_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_product_feedback_prompt(_business_id uuid)
RETURNS TABLE(activation_id uuid,product_area text,workflow text,prompt_reason text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT a.id,a.product_area,a.workflow,CASE WHEN a.status='abandoned' THEN 'abandoned' ELSE 'first_outcome' END
  FROM public.product_activation a
  WHERE a.user_id=auth.uid() AND a.business_id=_business_id
    AND (a.status='abandoned' OR (a.outcome_at IS NOT NULL AND a.outcome_at > now()-interval '7 days'))
    AND NOT EXISTS (SELECT 1 FROM public.product_feedback f WHERE f.activation_id=a.id)
    AND NOT EXISTS (SELECT 1 FROM public.product_feedback f WHERE f.user_id=auth.uid() AND f.prompted_at>now()-interval '14 days')
  ORDER BY CASE WHEN a.status='abandoned' THEN 0 ELSE 1 END,a.last_active_at DESC LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_product_feedback_prompt(uuid) TO authenticated;

CREATE TABLE public.lifecycle_campaign_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  test_mode boolean NOT NULL DEFAULT true,
  test_recipients text[] NOT NULL DEFAULT '{}',
  product_campaigns_enabled boolean NOT NULL DEFAULT false,
  cooldown_days integer NOT NULL DEFAULT 14,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,UPDATE ON public.lifecycle_campaign_config TO authenticated;
GRANT ALL ON public.lifecycle_campaign_config TO service_role;
ALTER TABLE public.lifecycle_campaign_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view lifecycle campaign config" ON public.lifecycle_campaign_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "Admins update lifecycle campaign config" ON public.lifecycle_campaign_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

CREATE TABLE public.lifecycle_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_area text,
  campaign_key text NOT NULL,
  recipient_email text NOT NULL,
  eligible boolean NOT NULL DEFAULT false,
  suppression_reason text,
  delivery_status text NOT NULL CHECK (delivery_status IN ('dry_run','suppressed','sent','failed')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lifecycle_email_deliveries TO authenticated;
GRANT ALL ON public.lifecycle_email_deliveries TO service_role;
ALTER TABLE public.lifecycle_email_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view lifecycle email deliveries" ON public.lifecycle_email_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'platform_admin'));
CREATE INDEX lifecycle_email_deliveries_lookup_idx ON public.lifecycle_email_deliveries(user_id,campaign_key,created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_product_discovery_overview(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'platform_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'areas',coalesce((SELECT jsonb_agg(x) FROM (SELECT product_area,count(*) journeys,count(*) FILTER(WHERE activated_at IS NOT NULL) activated,count(*) FILTER(WHERE outcome_at IS NOT NULL) outcomes,count(*) FILTER(WHERE status='abandoned') abandoned FROM product_activation WHERE last_active_at>=now()-(_days||' days')::interval GROUP BY product_area ORDER BY product_area)x),'[]'::jsonb),
    'intents',coalesce((SELECT jsonb_agg(x) FROM (SELECT intent,count(*) users,count(*) FILTER(WHERE is_primary) primary_users FROM user_intents GROUP BY intent ORDER BY count(*) DESC)x),'[]'::jsonb),
    'feedback',coalesce((SELECT jsonb_agg(x) FROM (SELECT product_area,count(*) responses,count(*) FILTER(WHERE alternative_tool IS NOT NULL) alternatives FROM product_feedback WHERE created_at>=now()-(_days||' days')::interval GROUP BY product_area)x),'[]'::jsonb)
  ) INTO result; RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_product_discovery_overview(integer) TO authenticated;