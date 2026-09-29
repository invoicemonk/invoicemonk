CREATE OR REPLACE FUNCTION public.admin_user_product_timeline(_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid; result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'platform_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO uid FROM profiles WHERE lower(email)=lower(trim(_email)) LIMIT 1;
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'user_id', uid,
    'stated', coalesce((SELECT jsonb_agg(jsonb_build_object('intent',intent,'is_primary',is_primary,'free_text',other_text,'created_at',created_at)) FROM user_intents WHERE user_id=uid),'[]'::jsonb),
    'observed', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.last_active_at DESC) FROM product_activation a WHERE a.user_id=uid),'[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event_type',event_type,'product_area',product_area,'workflow',workflow,'stage',stage,'business_id',business_id,'source',source,'created_at',created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM lifecycle_events WHERE user_id=uid AND product_area IS NOT NULL ORDER BY created_at DESC LIMIT 200) e),'[]'::jsonb),
    'feedback', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at DESC) FROM product_feedback f WHERE f.user_id=uid),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_user_product_timeline(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_product_timeline(text) TO authenticated;