-- ==========================================
-- BUSINESS IDENTITY & MULTI-CURRENCY SYSTEM
-- ==========================================

-- PART 1: BUSINESS IDENTITY

-- A) Add business_identity_level column
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS business_identity_level TEXT 
  DEFAULT 'unverified' 
  CHECK (business_identity_level IN ('unverified', 'self_declared', 'verified', 'nrs_linked'));

-- B) Create partial unique index on (tax_id, jurisdiction) where tax_id is not null
-- This allows duplicate NULL tax_ids (freelancers/unregistered) but prevents duplicate registered businesses
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_tax_id_jurisdiction_unique 
ON public.businesses (LOWER(tax_id), LOWER(jurisdiction)) 
WHERE tax_id IS NOT NULL AND tax_id != '';

-- C) Migrate existing data to set identity level based on tax_id presence
UPDATE public.businesses 
SET business_identity_level = 
  CASE 
    WHEN tax_id IS NULL OR tax_id = '' THEN 'unverified'
    ELSE 'self_declared'
  END
WHERE business_identity_level IS NULL OR business_identity_level = 'unverified';

-- PART 2: MULTI-CURRENCY SYSTEM

-- A) Add allowed_currencies array to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS allowed_currencies TEXT[] DEFAULT ARRAY[]::TEXT[];

-- B) Add exchange rate columns to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS exchange_rate_to_primary NUMERIC,
ADD COLUMN IF NOT EXISTS exchange_rate_snapshot JSONB;

-- C) Add exchange rate columns to expenses
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS exchange_rate_to_primary NUMERIC,
ADD COLUMN IF NOT EXISTS primary_currency TEXT;

-- D) Add currency and exchange rate columns to credit_notes
ALTER TABLE public.credit_notes 
ADD COLUMN IF NOT EXISTS currency TEXT,
ADD COLUMN IF NOT EXISTS exchange_rate_to_primary NUMERIC;

-- Migrate existing credit_notes to set currency from their original invoice
UPDATE public.credit_notes cn
SET currency = i.currency
FROM public.invoices i
WHERE cn.original_invoice_id = i.id
AND cn.currency IS NULL;

-- PART 3: VALIDATION TRIGGER FOR EXPENSE CURRENCY

-- Create or replace the expense currency validation function
CREATE OR REPLACE FUNCTION public.validate_expense_currency()
RETURNS TRIGGER AS $$
DECLARE
  _business_primary TEXT;
BEGIN
  -- Only validate if business_id is set
  IF NEW.business_id IS NOT NULL THEN
    SELECT default_currency INTO _business_primary 
    FROM public.businesses WHERE id = NEW.business_id;
    
    -- If business has a primary currency and expense currency differs
    IF _business_primary IS NOT NULL AND NEW.currency IS NOT NULL AND NEW.currency != _business_primary THEN
      -- Require exchange rate for non-primary currency expenses
      IF NEW.exchange_rate_to_primary IS NULL THEN
        RAISE EXCEPTION 'Exchange rate required for non-primary currency expenses. Business primary currency is %, expense currency is %', _business_primary, NEW.currency;
      END IF;
      -- Snapshot the primary currency
      NEW.primary_currency := _business_primary;
    ELSIF _business_primary IS NOT NULL AND (NEW.currency = _business_primary OR NEW.currency IS NULL) THEN
      -- Same currency as primary - no exchange rate needed
      NEW.primary_currency := _business_primary;
      NEW.exchange_rate_to_primary := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for expense currency validation
DROP TRIGGER IF EXISTS validate_expense_currency_trigger ON public.expenses;
CREATE TRIGGER validate_expense_currency_trigger
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_currency();

-- PART 4: UPDATE ISSUE_INVOICE FUNCTION TO HANDLE EXCHANGE RATES

CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
 RETURNS invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice invoices;
  _business businesses;
  _client clients;
  _template invoice_templates;
  _tax_schema tax_schemas;
  _retention_policy retention_policies;
  _user_profile profiles;
  _retention_years INTEGER;
  _limit_check JSON;
  _exchange_rate_snapshot JSONB;
BEGIN
  -- Get the invoice
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  -- Check if already issued
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Invoice is not in draft status';
  END IF;
  
  -- Check if business_id is set
  IF _invoice.business_id IS NULL THEN
    RAISE EXCEPTION 'Invoice must be associated with a business before issuing. Please complete your business profile first.';
  END IF;
  
  -- Get user profile and verify email
  SELECT * INTO _user_profile FROM profiles WHERE id = auth.uid();
  IF _user_profile IS NULL OR _user_profile.email_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Email must be verified before issuing invoices';
  END IF;
  
  -- Check tier limits
  SELECT check_tier_limit(auth.uid(), 'invoices_per_month') INTO _limit_check;
  IF (_limit_check->>'allowed')::boolean = false THEN
    RAISE EXCEPTION 'Monthly invoice limit reached. Please upgrade your plan.';
  END IF;
  
  -- Get template and validate tier
  IF _invoice.template_id IS NOT NULL THEN
    SELECT * INTO _template FROM invoice_templates WHERE id = _invoice.template_id;
    IF _template IS NOT NULL AND _template.tier_required IS NOT NULL THEN
      IF NOT has_tier(auth.uid(), _template.tier_required) THEN
        RAISE EXCEPTION 'Template requires % tier or higher', _template.tier_required;
      END IF;
    END IF;
  END IF;
  
  -- Get business
  SELECT * INTO _business FROM businesses WHERE id = _invoice.business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found. Please complete your business profile.';
  END IF;
  
  -- Validate tax rate for Nigerian VAT-registered businesses
  IF _business.jurisdiction = 'NG' AND _business.is_vat_registered = true THEN
    IF EXISTS (
      SELECT 1 FROM invoice_items 
      WHERE invoice_id = _invoice_id 
      AND tax_rate NOT IN (0, 7.5)
    ) THEN
      RAISE EXCEPTION 'Nigerian VAT invoices must use 7.5%% tax rate or 0%% for exempt items';
    END IF;
  END IF;
  
  -- Get client
  SELECT * INTO _client FROM clients WHERE id = _invoice.client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;
  
  -- Get tax schema if set
  IF _invoice.tax_schema_id IS NOT NULL THEN
    SELECT * INTO _tax_schema FROM tax_schemas WHERE id = _invoice.tax_schema_id;
  END IF;
  
  -- Get retention policy
  SELECT * INTO _retention_policy 
  FROM retention_policies 
  WHERE jurisdiction = _business.jurisdiction AND entity_type = 'invoice'
  ORDER BY created_at DESC
  LIMIT 1;
  
  _retention_years := COALESCE(_retention_policy.retention_years, 7);
  
  -- Build exchange rate snapshot if invoice currency differs from business primary
  IF _invoice.currency IS NOT NULL AND _business.default_currency IS NOT NULL 
     AND _invoice.currency != _business.default_currency THEN
    -- Require exchange_rate_to_primary if currencies differ
    IF _invoice.exchange_rate_to_primary IS NULL THEN
      RAISE EXCEPTION 'Exchange rate to primary currency is required when invoice currency (%) differs from business primary currency (%)', 
        _invoice.currency, _business.default_currency;
    END IF;
    
    _exchange_rate_snapshot := jsonb_build_object(
      'primary_currency', _business.default_currency,
      'invoice_currency', _invoice.currency,
      'rate_to_primary', _invoice.exchange_rate_to_primary,
      'rate_date', CURRENT_DATE,
      'source', 'manual'
    );
  ELSE
    -- Same currency or no business currency set
    _exchange_rate_snapshot := NULL;
  END IF;
  
  -- Update invoice with all issuance data
  UPDATE invoices SET
    status = 'issued',
    issued_at = now(),
    issued_by = auth.uid(),
    issue_date = COALESCE(issue_date, CURRENT_DATE),
    verification_id = COALESCE(verification_id, gen_random_uuid()),
    invoice_hash = encode(sha256((_invoice_id::text || now()::text)::bytea), 'hex'),
    retention_locked_until = (CURRENT_DATE + (_retention_years || ' years')::interval)::date,
    currency_locked_at = COALESCE(currency_locked_at, now()),
    exchange_rate_snapshot = COALESCE(exchange_rate_snapshot, _exchange_rate_snapshot),
    issuer_snapshot = jsonb_build_object(
      'name', _business.name,
      'legal_name', _business.legal_name,
      'tax_id', _business.tax_id,
      'cac_number', _business.cac_number,
      'address', _business.address,
      'contact_email', _business.contact_email,
      'contact_phone', _business.contact_phone,
      'logo_url', _business.logo_url,
      'jurisdiction', _business.jurisdiction,
      'is_vat_registered', _business.is_vat_registered,
      'vat_registration_number', _business.vat_registration_number,
      'business_identity_level', _business.business_identity_level
    ),
    recipient_snapshot = jsonb_build_object(
      'name', _client.name,
      'email', _client.email,
      'phone', _client.phone,
      'tax_id', _client.tax_id,
      'cac_number', _client.cac_number,
      'client_type', _client.client_type,
      'contact_person', _client.contact_person,
      'address', _client.address
    ),
    tax_schema_snapshot = CASE 
      WHEN _tax_schema IS NOT NULL THEN jsonb_build_object(
        'name', _tax_schema.name,
        'jurisdiction', _tax_schema.jurisdiction,
        'version', _tax_schema.version,
        'rates', _tax_schema.rates
      )
      ELSE NULL
    END,
    tax_schema_version = _tax_schema.version,
    template_snapshot = CASE
      WHEN _template IS NOT NULL THEN jsonb_build_object(
        'name', _template.name,
        'layout', _template.layout,
        'styles', _template.styles
      )
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = _invoice_id
  RETURNING * INTO _invoice;
  
  -- Log audit event
  PERFORM log_audit_event(
    _entity_type := 'invoice',
    _entity_id := _invoice_id,
    _event_type := 'INVOICE_ISSUED',
    _business_id := _invoice.business_id,
    _user_id := auth.uid(),
    _new_state := row_to_json(_invoice)::jsonb
  );
  
  RETURN _invoice;
END;
$function$;