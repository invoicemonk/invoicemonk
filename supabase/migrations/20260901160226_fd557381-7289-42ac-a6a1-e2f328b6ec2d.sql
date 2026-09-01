CREATE OR REPLACE FUNCTION public.enforce_invoice_template_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tier subscription_tier;
  _required subscription_tier;
  _default_id uuid;
  _rank_tier int;
  _rank_required int;
BEGIN
  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.template_id IS NOT DISTINCT FROM OLD.template_id
     AND NEW.template_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve the effective tier for the business
  SELECT COALESCE(s.tier, 'starter') INTO _tier
  FROM public.businesses b
  LEFT JOIN public.subscriptions s ON s.business_id = b.id
    AND (
      s.status = 'active'
      OR s.status = 'trialing'
      OR (s.status = 'past_due'
          AND (s.current_period_end IS NULL OR s.current_period_end + interval '3 days' >= now()))
    )
  WHERE b.id = NEW.business_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _tier IS NULL THEN
    _tier := 'starter';
  END IF;

  _rank_tier := CASE _tier
    WHEN 'starter' THEN 0 WHEN 'starter_paid' THEN 1
    WHEN 'professional' THEN 2 WHEN 'business' THEN 3 END;

  -- Best template the tier is entitled to (Basic for free plans)
  SELECT t.id INTO _default_id
  FROM public.invoice_templates t
  WHERE t.is_active = true
    AND (CASE t.tier_required
      WHEN 'starter' THEN 0 WHEN 'starter_paid' THEN 1
      WHEN 'professional' THEN 2 WHEN 'business' THEN 3 END) <= _rank_tier
  ORDER BY (CASE t.tier_required
      WHEN 'starter' THEN 0 WHEN 'starter_paid' THEN 1
      WHEN 'professional' THEN 2 WHEN 'business' THEN 3 END) DESC, t.sort_order
  LIMIT 1;

  -- No template chosen: assign the entitled default
  IF NEW.template_id IS NULL THEN
    NEW.template_id := _default_id;
    RETURN NEW;
  END IF;

  SELECT t.tier_required INTO _required
  FROM public.invoice_templates t
  WHERE t.id = NEW.template_id;

  IF _required IS NULL THEN
    NEW.template_id := _default_id;
    RETURN NEW;
  END IF;

  _rank_required := CASE _required
    WHEN 'starter' THEN 0 WHEN 'starter_paid' THEN 1
    WHEN 'professional' THEN 2 WHEN 'business' THEN 3 END;

  IF _rank_tier >= _rank_required THEN
    RETURN NEW;
  END IF;

  -- Not entitled: fall back to the basic (starter) template
  SELECT t.id INTO _default_id
  FROM public.invoice_templates t
  WHERE t.is_active = true AND t.tier_required = 'starter'
  ORDER BY t.sort_order
  LIMIT 1;

  NEW.template_id := _default_id;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_invoice_template_tier() FROM PUBLIC, anon, authenticated;