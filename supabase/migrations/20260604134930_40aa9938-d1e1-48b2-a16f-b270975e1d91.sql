-- Add onboarding wizard progress column to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_step text;

-- Backfill: mark businesses whose profile already looks complete as 'completed'.
-- Heuristic mirrors the frontend `profile-completion` rules at a coarse level:
--   - name, jurisdiction, default_currency, contact_email, address.country present
--   - non-individuals: legal_name and a tax_id in business_sensitive_data
--   - has at least one payment method OR online_payments_enabled
--   - has a logo_url
-- Anything else is left NULL so the wizard will pick it up on next login.
WITH eligible AS (
  SELECT b.id
  FROM public.businesses b
  LEFT JOIN public.business_sensitive_data s ON s.business_id = b.id
  WHERE b.name IS NOT NULL
    AND b.jurisdiction IS NOT NULL
    AND b.default_currency IS NOT NULL
    AND b.contact_email IS NOT NULL
    AND b.address ? 'country'
    AND b.logo_url IS NOT NULL
    AND (
      b.entity_type = 'individual'
      OR (b.legal_name IS NOT NULL AND s.tax_id IS NOT NULL)
    )
    AND (
      b.online_payments_enabled = true
      OR EXISTS (SELECT 1 FROM public.payment_methods pm WHERE pm.business_id = b.id)
    )
)
UPDATE public.businesses
SET onboarding_step = 'completed'
WHERE id IN (SELECT id FROM eligible);