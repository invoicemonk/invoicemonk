GRANT EXECUTE ON FUNCTION public.delete_empty_business(uuid) TO authenticated;

-- 1. Backfill from most recent invoice currency
UPDATE public.businesses b
SET default_currency = sub.currency
FROM (
  SELECT DISTINCT ON (i.business_id) i.business_id, i.currency
  FROM public.invoices i
  WHERE i.currency IS NOT NULL
  ORDER BY i.business_id, i.created_at DESC
) sub
WHERE b.id = sub.business_id AND b.default_currency IS NULL;

-- 2. Backfill from existing currency account (default first)
UPDATE public.businesses b
SET default_currency = sub.currency
FROM (
  SELECT DISTINCT ON (ca.business_id) ca.business_id, ca.currency
  FROM public.currency_accounts ca
  WHERE ca.currency IS NOT NULL
  ORDER BY ca.business_id, ca.is_default DESC NULLS LAST, ca.created_at ASC
) sub
WHERE b.id = sub.business_id AND b.default_currency IS NULL;

-- 3. Create a default currency account for businesses that have a currency but no account
INSERT INTO public.currency_accounts (business_id, currency, is_default, name)
SELECT b.id, b.default_currency, true, b.default_currency || ' Account'
FROM public.businesses b
WHERE b.default_currency IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.currency_accounts ca WHERE ca.business_id = b.id);