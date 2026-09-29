ALTER TABLE public.lifecycle_campaign_config ADD COLUMN IF NOT EXISTS upgrade_campaigns_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_upgrade_candidates()
RETURNS TABLE(user_id uuid, email text, full_name text, business_id uuid, tier text, triggers text[],
  invoices_this_month integer, receipts_count integer, issued_invoices integer,
  upgrade_sent_count integer, last_upgrade_at timestamptz, sent_triggers text[], excluded_reason text,
  has_open_abandonment boolean, research_active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(), 'platform_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH owners AS (
    SELECT DISTINCT ON (bm.user_id) bm.user_id AS uid, bm.business_id AS bid
    FROM business_members bm WHERE bm.role='owner' ORDER BY bm.user_id, bm.created_at
  ), base AS (
    SELECT p.id, p.email, p.full_name, o.bid, p.account_status,
      coalesce((SELECT s.tier::text FROM subscriptions s WHERE s.business_id=o.bid AND s.status IN ('active','trialing') ORDER BY s.created_at DESC LIMIT 1),'starter') AS t,
      (SELECT count(*)::int FROM invoices i WHERE i.business_id=o.bid AND i.status<>'draft' AND i.issued_at >= date_trunc('month', now())) AS inv_m,
      (SELECT count(*)::int FROM receipts r WHERE r.business_id=o.bid) AS rec,
      (SELECT count(*)::int FROM invoices i WHERE i.business_id=o.bid AND i.status<>'draft') AS inv_all,
      ARRAY(SELECT DISTINCT split_part(le.event_type,'.',3) FROM lifecycle_events le WHERE le.user_id=p.id AND le.product_area='upgrade'
            AND le.event_type LIKE 'product.upgrade.%_blocked' AND le.created_at > now() - interval '30 days') AS blocked,
      EXISTS (SELECT 1 FROM fraud_flags f WHERE f.business_id=o.bid AND f.resolved IS NOT TRUE) AS fraud,
      EXISTS (SELECT 1 FROM user_preferences up WHERE up.user_id=p.id AND up.email_product_tips = false) AS opted_out
    FROM profiles p JOIN owners o ON o.uid=p.id
  )
  SELECT b.id, b.email, b.full_name, b.bid, b.t,
    array_remove(ARRAY[
      CASE WHEN b.t='starter' AND b.inv_m >= 3 THEN 'invoice_limit' END,
      CASE WHEN b.t='starter' AND b.rec >= 5 THEN 'receipt_limit' END,
      CASE WHEN b.t='starter' AND 'clients_limit_blocked' = ANY(b.blocked) THEN 'client_limit' END,
      CASE WHEN b.inv_all >= 3 THEN 'watermark' END
    ] || ARRAY(SELECT x FROM unnest(b.blocked) x WHERE x <> 'clients_limit_blocked'), NULL),
    b.inv_m, b.rec, b.inv_all,
    (SELECT count(*)::int FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'upgrade-v1:%' AND d.delivery_status='sent'),
    (SELECT max(d.created_at) FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'upgrade-v1:%' AND d.delivery_status='sent'),
    ARRAY(SELECT split_part(d.campaign_key,':',2) FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'upgrade-v1:%' AND d.delivery_status='sent'),
    CASE WHEN b.account_status IS DISTINCT FROM 'active' THEN 'account_'||coalesce(b.account_status,'unknown')
         WHEN b.fraud THEN 'fraud_flagged' WHEN b.opted_out THEN 'unsubscribed' END,
    EXISTS (SELECT 1 FROM product_activation pa WHERE pa.user_id=b.id AND pa.status='abandoned' AND pa.outcome_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.suppression_reason='insufficient_journey_context' AND d.metadata->>'journey_id' = pa.id::text)),
    EXISTS (SELECT 1 FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'research-v1:%' AND d.delivery_status='sent' AND d.created_at > now() - interval '30 days')
  FROM base b
  WHERE b.t IN ('starter','starter_paid')
  ORDER BY b.inv_all DESC
  LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.get_upgrade_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_upgrade_candidates() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_dormant_research_candidates(_days integer DEFAULT 21)
RETURNS TABLE(user_id uuid, email text, full_name text, last_active_at timestamptz, segment text, excluded_reason text,
  cancellation_reason text, cancellation_details text, research_sent_count integer, last_research_step text,
  last_research_at timestamptz, responded_at timestamptz, response text, alternative_tool text, has_open_abandonment boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(), 'platform_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH act AS (
    SELECT p.id AS uid, greatest(
      (SELECT max(le.created_at) FROM lifecycle_events le WHERE le.user_id=p.id AND le.product_area IS NOT NULL AND le.product_area NOT IN ('discovery','upgrade')),
      (SELECT max(i.created_at) FROM invoices i WHERE i.user_id=p.id),
      (SELECT max(e.created_at) FROM expenses e WHERE e.user_id=p.id)) AS last_at
    FROM profiles p
  ), base AS (
    SELECT p.id, p.email, p.full_name, a.last_at, p.account_status,
      EXISTS (SELECT 1 FROM fraud_flags f JOIN business_members bm ON bm.business_id=f.business_id WHERE bm.user_id=p.id AND f.resolved IS NOT TRUE) AS fraud,
      EXISTS (SELECT 1 FROM user_preferences up WHERE up.user_id=p.id AND up.email_product_tips = false) AS opted_out,
      EXISTS (SELECT 1 FROM product_activation pa WHERE pa.user_id=p.id AND pa.activated_at IS NOT NULL)
        OR EXISTS (SELECT 1 FROM invoices i WHERE i.user_id=p.id AND i.status<>'draft') AS activated,
      (SELECT cf.reason FROM churn_feedback cf WHERE cf.user_id=p.id ORDER BY cf.created_at DESC LIMIT 1) AS c_reason,
      (SELECT cf.details FROM churn_feedback cf WHERE cf.user_id=p.id ORDER BY cf.created_at DESC LIMIT 1) AS c_details
    FROM profiles p JOIN act a ON a.uid=p.id
    WHERE a.last_at IS NOT NULL AND a.last_at < now() - make_interval(days => _days)
  )
  SELECT b.id, b.email, b.full_name, b.last_at,
    CASE WHEN b.account_status IS DISTINCT FROM 'active' OR b.fraud THEN 'D' WHEN b.opted_out THEN 'E'
         WHEN b.c_reason IS NOT NULL THEN 'C' WHEN b.activated THEN 'A' ELSE 'B' END,
    CASE WHEN b.account_status IS DISTINCT FROM 'active' THEN 'account_'||coalesce(b.account_status,'unknown')
         WHEN b.fraud THEN 'fraud_flagged' WHEN b.opted_out THEN 'unsubscribed' END,
    b.c_reason, b.c_details,
    (SELECT count(*)::int FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'research-v1:%' AND d.delivery_status='sent'),
    (SELECT d.campaign_key FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'research-v1:%' AND d.delivery_status='sent' ORDER BY d.created_at DESC LIMIT 1),
    (SELECT max(d.created_at) FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'research-v1:%' AND d.delivery_status='sent'),
    (SELECT max(pf.responded_at) FROM product_feedback pf WHERE pf.user_id=b.id AND pf.prompt_reason='dormant_research'),
    (SELECT pf.response FROM product_feedback pf WHERE pf.user_id=b.id AND pf.prompt_reason='dormant_research' ORDER BY pf.responded_at DESC NULLS LAST LIMIT 1),
    (SELECT pf.alternative_tool FROM product_feedback pf WHERE pf.user_id=b.id AND pf.prompt_reason='dormant_research' ORDER BY pf.responded_at DESC NULLS LAST LIMIT 1),
    EXISTS (SELECT 1 FROM product_activation pa WHERE pa.user_id=b.id AND pa.status='abandoned' AND pa.outcome_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'product-tip-v%' AND d.suppression_reason='insufficient_journey_context' AND d.metadata->>'journey_id' = pa.id::text))
  FROM base b
  ORDER BY b.last_at DESC
  LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.sync_product_activation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE milestone text := coalesce(NEW.metadata->>'milestone',NEW.stage); r record; prev text;
BEGIN
  IF NEW.product_area IS NULL OR NEW.user_id IS NULL OR NEW.product_area IN ('discovery','upgrade') THEN RETURN NEW; END IF;
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
END $function$;