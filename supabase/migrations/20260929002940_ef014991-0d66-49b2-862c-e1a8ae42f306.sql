ALTER TABLE public.product_activation DROP CONSTRAINT product_activation_user_id_business_id_product_area_key;
ALTER TABLE public.product_activation ADD CONSTRAINT product_activation_journey_key UNIQUE NULLS NOT DISTINCT (user_id,business_id,product_area,workflow);
ALTER TABLE public.product_activation ADD COLUMN IF NOT EXISTS reactivated_at timestamptz;

CREATE TABLE public.product_activation_rules (
  product_area text NOT NULL,
  workflow text NOT NULL DEFAULT '*',
  inactive_after_days integer NOT NULL,
  abandoned_after_days integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_area, workflow)
);
GRANT SELECT ON public.product_activation_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_activation_rules TO authenticated;
GRANT ALL ON public.product_activation_rules TO service_role;
ALTER TABLE public.product_activation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read activation rules" ON public.product_activation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage activation rules" ON public.product_activation_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));
CREATE TRIGGER update_product_activation_rules_updated_at BEFORE UPDATE ON public.product_activation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_activation_rules(product_area,inactive_after_days,abandoned_after_days) VALUES
 ('invoicing',14,30),('payments',21,45),('receipts',21,45),('credit_notes',30,60),('clients',21,45),
 ('products_services',21,45),('expenses',10,30),('receipt_capture',7,21),('recurring_expenses',30,60),
 ('vendors',21,45),('accounting',14,30),('tax_reports',30,90),('reports',14,45),('data_import',3,14),
 ('data_export',30,90),('team',30,60),('e_invoicing',7,21)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_product_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE milestone text := coalesce(NEW.metadata->>'milestone',NEW.stage); r record; prev text;
BEGIN
  IF NEW.product_area IS NULL OR NEW.user_id IS NULL OR NEW.product_area = 'discovery' THEN RETURN NEW; END IF;
  SELECT inactive_after_days i, abandoned_after_days a INTO r FROM product_activation_rules
    WHERE product_area=NEW.product_area AND workflow IN (coalesce(NEW.workflow,'*'),'*') ORDER BY (workflow='*') LIMIT 1;
  SELECT status INTO prev FROM product_activation WHERE user_id=NEW.user_id AND business_id IS NOT DISTINCT FROM NEW.business_id
    AND product_area=NEW.product_area AND workflow IS NOT DISTINCT FROM NEW.workflow;
  INSERT INTO product_activation(user_id,business_id,product_area,workflow,status,started_at,activated_at,outcome_at,repeated_at,last_active_at,stopped_step,inactive_after_days,abandoned_after_days)
  VALUES(NEW.user_id,NEW.business_id,NEW.product_area,NEW.workflow,'started',NEW.created_at,
    CASE WHEN milestone='activated' THEN NEW.created_at END, CASE WHEN milestone='outcome' THEN NEW.created_at END,
    CASE WHEN NEW.stage='repeat' THEN NEW.created_at END,NEW.created_at,NEW.event_type,coalesce(r.i,14),coalesce(r.a,30))
  ON CONFLICT ON CONSTRAINT product_activation_journey_key DO UPDATE SET
    activated_at=coalesce(product_activation.activated_at,EXCLUDED.activated_at),
    outcome_at=coalesce(product_activation.outcome_at,EXCLUDED.outcome_at),
    repeated_at=coalesce(EXCLUDED.repeated_at,product_activation.repeated_at),
    reactivated_at=CASE WHEN product_activation.status IN ('inactive','abandoned') THEN EXCLUDED.last_active_at ELSE product_activation.reactivated_at END,
    last_active_at=EXCLUDED.last_active_at, stopped_step=EXCLUDED.stopped_step,
    inactive_after_days=EXCLUDED.inactive_after_days, abandoned_after_days=EXCLUDED.abandoned_after_days, updated_at=now();
  UPDATE product_activation SET status = CASE WHEN repeated_at IS NOT NULL THEN 'repeat' WHEN outcome_at IS NOT NULL THEN 'outcome'
      WHEN activated_at IS NOT NULL THEN 'activated' ELSE 'started' END
    WHERE user_id=NEW.user_id AND business_id IS NOT DISTINCT FROM NEW.business_id AND product_area=NEW.product_area AND workflow IS NOT DISTINCT FROM NEW.workflow;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'sync_product_activation failed: %', SQLERRM; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_product_activation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_product_abandonment()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
  WITH calc AS (
    SELECT id, CASE
      WHEN last_active_at < now()-(abandoned_after_days||' days')::interval AND outcome_at IS NULL THEN 'abandoned'
      WHEN last_active_at < now()-(inactive_after_days||' days')::interval THEN 'inactive'
      ELSE NULL END AS next_status
    FROM product_activation WHERE status <> 'abandoned')
  UPDATE product_activation p SET status=c.next_status, updated_at=now()
  FROM calc c WHERE p.id=c.id AND c.next_status IS NOT NULL AND p.status IS DISTINCT FROM c.next_status;
  GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.evaluate_product_abandonment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_product_abandonment() TO service_role;

INSERT INTO public.lifecycle_campaign_config(id,test_mode) VALUES (true,true) ON CONFLICT (id) DO NOTHING;

DROP FUNCTION IF EXISTS public.admin_product_discovery_overview(integer);
CREATE OR REPLACE FUNCTION public.admin_product_discovery_overview(
  _days integer DEFAULT 30, _business_id uuid DEFAULT NULL, _area text DEFAULT NULL,
  _workflow text DEFAULT NULL, _intent text DEFAULT NULL, _status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'platform_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  WITH pa AS (
    SELECT a.* FROM product_activation a
    WHERE a.last_active_at >= now()-(_days||' days')::interval
      AND (_business_id IS NULL OR a.business_id=_business_id)
      AND (_area IS NULL OR a.product_area=_area)
      AND (_workflow IS NULL OR a.workflow=_workflow)
      AND (_status IS NULL OR a.status=_status)
      AND (_intent IS NULL OR EXISTS (SELECT 1 FROM user_intents i WHERE i.user_id=a.user_id AND i.intent=_intent)))
  SELECT jsonb_build_object(
    'overview', (SELECT jsonb_build_object('users',count(DISTINCT user_id),'journeys',count(*),
        'activated',count(*) FILTER (WHERE activated_at IS NOT NULL),'outcomes',count(*) FILTER (WHERE outcome_at IS NOT NULL),
        'repeat',count(*) FILTER (WHERE repeated_at IS NOT NULL),'inactive',count(*) FILTER (WHERE status='inactive'),
        'abandoned',count(*) FILTER (WHERE status='abandoned'),'reactivated',count(*) FILTER (WHERE reactivated_at IS NOT NULL)) FROM pa),
    'areas', coalesce((SELECT jsonb_agg(x ORDER BY x.journeys DESC) FROM (SELECT product_area,count(*) journeys,
        count(*) FILTER (WHERE activated_at IS NOT NULL) activated,count(*) FILTER (WHERE outcome_at IS NOT NULL) outcomes,
        count(*) FILTER (WHERE repeated_at IS NOT NULL) repeats,count(*) FILTER (WHERE status='inactive') inactive,
        count(*) FILTER (WHERE status='abandoned') abandoned FROM pa GROUP BY product_area)x),'[]'::jsonb),
    'workflows', coalesce((SELECT jsonb_agg(x) FROM (SELECT product_area,workflow,count(*) journeys,
        count(*) FILTER (WHERE status='abandoned') abandoned, mode() WITHIN GROUP (ORDER BY stopped_step) FILTER (WHERE status IN ('inactive','abandoned')) common_stop
        FROM pa GROUP BY product_area,workflow)x),'[]'::jsonb),
    'intents', coalesce((SELECT jsonb_agg(x ORDER BY x.users DESC) FROM (SELECT intent,count(*) users,count(*) FILTER (WHERE is_primary) primary_users
        FROM user_intents GROUP BY intent)x),'[]'::jsonb),
    'funnel', coalesce((SELECT jsonb_agg(x) FROM (SELECT i.intent,pa.product_area,count(DISTINCT pa.user_id) started,
        count(DISTINCT pa.user_id) FILTER (WHERE pa.activated_at IS NOT NULL) activated,
        count(DISTINCT pa.user_id) FILTER (WHERE pa.outcome_at IS NOT NULL) outcomes
        FROM user_intents i JOIN pa ON pa.user_id=i.user_id GROUP BY i.intent,pa.product_area)x),'[]'::jsonb),
    'feedback', coalesce((SELECT jsonb_agg(x) FROM (SELECT product_area,count(*) FILTER (WHERE NOT dismissed) responses,
        count(*) FILTER (WHERE dismissed) dismissed,count(*) FILTER (WHERE alternative_tool IS NOT NULL) alternatives,
        array_remove(array_agg(DISTINCT lower(alternative_tool)),NULL) tools
        FROM product_feedback WHERE created_at>=now()-(_days||' days')::interval
          AND (_business_id IS NULL OR business_id=_business_id) AND (_area IS NULL OR product_area=_area) GROUP BY product_area)x),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_product_discovery_overview(integer,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_discovery_overview(integer,uuid,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_product_timeline(_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid; result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'platform_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO uid FROM profiles WHERE lower(email)=lower(trim(_email)) LIMIT 1;
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'user_id', uid,
    'stated', coalesce((SELECT jsonb_agg(jsonb_build_object('intent',intent,'is_primary',is_primary,'free_text',free_text,'created_at',created_at)) FROM user_intents WHERE user_id=uid),'[]'::jsonb),
    'observed', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.last_active_at DESC) FROM product_activation a WHERE a.user_id=uid),'[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event_type',event_type,'product_area',product_area,'workflow',workflow,'stage',stage,'business_id',business_id,'source',source,'created_at',created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM lifecycle_events WHERE user_id=uid AND product_area IS NOT NULL ORDER BY created_at DESC LIMIT 200) e),'[]'::jsonb),
    'feedback', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at DESC) FROM product_feedback f WHERE f.user_id=uid),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_user_product_timeline(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_product_timeline(text) TO authenticated;