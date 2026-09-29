ALTER TABLE public.lifecycle_campaign_config ADD COLUMN IF NOT EXISTS research_campaigns_enabled boolean NOT NULL DEFAULT false;

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
      (SELECT max(le.created_at) FROM lifecycle_events le WHERE le.user_id=p.id AND le.product_area IS NOT NULL AND le.product_area<>'discovery'),
      (SELECT max(i.created_at) FROM invoices i WHERE i.user_id=p.id),
      (SELECT max(e.created_at) FROM expenses e WHERE e.user_id=p.id)) AS last_at
    FROM profiles p
  ), base AS (
    SELECT p.id, p.email, p.full_name, a.last_at, p.account_status,
      EXISTS (SELECT 1 FROM fraud_flags f JOIN business_members bm ON bm.business_id=f.business_id WHERE bm.user_id=p.id AND f.resolved IS NOT TRUE) AS fraud,
      EXISTS (SELECT 1 FROM user_preferences up WHERE up.user_id=p.id AND up.email_product_tips = false) AS opted_out,
      EXISTS (SELECT 1 FROM product_activation pa WHERE pa.user_id=p.id AND pa.activated_at IS NOT NULL)
        OR EXISTS (SELECT 1 FROM invoices i WHERE i.user_id=p.id AND i.status<>'draft') AS activated,
      (SELECT row(cf.reason, cf.details)::record FROM churn_feedback cf WHERE cf.user_id=p.id ORDER BY cf.created_at DESC LIMIT 1) AS churn,
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
      AND NOT EXISTS (SELECT 1 FROM lifecycle_email_deliveries d WHERE d.user_id=b.id AND d.campaign_key LIKE 'product-tip-v1:%' AND d.suppression_reason='insufficient_journey_context' AND d.metadata->>'journey_id' = pa.id::text))
  FROM base b
  ORDER BY b.last_at DESC
  LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.get_dormant_research_candidates(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dormant_research_candidates(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_log_research_response(_user_id uuid, _response text, _alternative_tool text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE biz uuid; new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _response IS NULL OR length(trim(_response)) = 0 OR length(_response) > 5000 THEN RAISE EXCEPTION 'Response must be 1-5000 characters'; END IF;
  IF length(coalesce(_alternative_tool,'')) > 200 THEN RAISE EXCEPTION 'Tool name too long'; END IF;
  SELECT business_id INTO biz FROM business_members WHERE user_id=_user_id ORDER BY (role='owner') DESC, created_at LIMIT 1;
  IF biz IS NULL THEN RAISE EXCEPTION 'User has no business'; END IF;
  INSERT INTO product_feedback(user_id,business_id,product_area,workflow,prompt_reason,response,alternative_tool,responded_at)
  VALUES (_user_id,biz,'discovery','dormant_research','dormant_research',trim(_response),nullif(trim(coalesce(_alternative_tool,'')),''),now())
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_log_research_response(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_research_response(uuid,text,text) TO authenticated;