CREATE OR REPLACE FUNCTION public.enforce_invoice_template_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _template public.invoice_templates%ROWTYPE;
BEGIN
  IF NEW.template_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _template
  FROM public.invoice_templates
  WHERE id = NEW.template_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected invoice template is unavailable';
  END IF;

  IF public.has_role(COALESCE(auth.uid(), NEW.user_id), 'platform_admin'::public.app_role)
     OR EXISTS (
       SELECT 1
       FROM public.business_members bm
       WHERE bm.business_id = NEW.business_id
         AND bm.user_id = auth.uid()
         AND public.has_role(bm.user_id, 'platform_admin'::public.app_role)
     ) THEN
    RETURN NEW;
  END IF;

  IF NOT public.has_tier(auth.uid(), _template.tier_required) THEN
    RAISE EXCEPTION 'Template requires % tier or higher', _template.tier_required;
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.invoices
SET template_id = '93033737-a1d9-4993-8944-cde633c8d7ea'::uuid
WHERE id = '7a9b67fc-8f89-4815-8e6c-78379e3bf330'::uuid
  AND status = 'draft'
  AND public.has_role(auth.uid(), 'platform_admin'::public.app_role);