-- 1. Keep businesses.allowed_currencies in sync with currency_accounts.
CREATE OR REPLACE FUNCTION public.sync_allowed_currencies_from_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.businesses b
  SET allowed_currencies = (
        SELECT ARRAY(
          SELECT DISTINCT c
          FROM unnest(COALESCE(b.allowed_currencies, ARRAY[]::text[]) || ARRAY[NEW.currency]) AS c
          WHERE c IS NOT NULL
            AND c <> ''
            AND c IS DISTINCT FROM b.default_currency
        )
      ),
      updated_at = now()
  WHERE b.id = NEW.business_id
    AND (
      NEW.currency IS DISTINCT FROM b.default_currency
      AND NOT (NEW.currency = ANY(COALESCE(b.allowed_currencies, ARRAY[]::text[])))
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_allowed_currencies_from_account ON public.currency_accounts;
CREATE TRIGGER trg_sync_allowed_currencies_from_account
AFTER INSERT ON public.currency_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_allowed_currencies_from_account();

-- 2. Backfill permitted currencies for every existing business from its accounts.
UPDATE public.businesses b
SET allowed_currencies = sub.currencies,
    updated_at = now()
FROM (
  SELECT ca.business_id,
         ARRAY_AGG(DISTINCT ca.currency) AS currencies
  FROM public.currency_accounts ca
  JOIN public.businesses bb ON bb.id = ca.business_id
  WHERE ca.currency IS DISTINCT FROM bb.default_currency
  GROUP BY ca.business_id
) sub
WHERE b.id = sub.business_id
  AND NOT (COALESCE(b.allowed_currencies, ARRAY[]::text[]) @> sub.currencies);

-- 3. Create the missing default currency account for businesses that have a
--    currency but no account (auto_create_default_currency_account skipped them).
INSERT INTO public.currency_accounts (business_id, currency, name, is_default)
SELECT b.id, b.default_currency, b.default_currency || ' Account', true
FROM public.businesses b
WHERE b.default_currency IS NOT NULL
  AND b.default_currency <> ''
  AND NOT EXISTS (SELECT 1 FROM public.currency_accounts ca WHERE ca.business_id = b.id);