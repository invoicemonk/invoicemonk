-- Phase 1: Critical Compliance Fixes

-- 1. Add compliance_status to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'incomplete';

-- 2. Add summary to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS summary TEXT;

-- 3. Create compliance computation function
CREATE OR REPLACE FUNCTION compute_business_compliance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.compliance_status := CASE
    WHEN NEW.name IS NOT NULL 
      AND NEW.legal_name IS NOT NULL
      AND NEW.contact_email IS NOT NULL
      AND NEW.address IS NOT NULL
      AND (NEW.address->>'city') IS NOT NULL
      AND (NEW.address->>'country') IS NOT NULL
    THEN 'complete'
    ELSE 'incomplete'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add trigger for compliance status computation
DROP TRIGGER IF EXISTS update_compliance_status ON businesses;
CREATE TRIGGER update_compliance_status
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION compute_business_compliance();

-- 5. Update existing businesses to compute their compliance status
UPDATE businesses SET updated_at = now();

-- 6. Create has_tier function for template tier validation
CREATE OR REPLACE FUNCTION has_tier(
  _user_id UUID,
  _required_tier subscription_tier
) RETURNS BOOLEAN AS $$
DECLARE
  _user_tier subscription_tier;
  _tier_order INTEGER;
  _required_order INTEGER;
BEGIN
  -- Get user's current tier
  SELECT tier INTO _user_tier
  FROM subscriptions
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Default to starter if no subscription
  IF _user_tier IS NULL THEN
    _user_tier := 'starter';
  END IF;
  
  -- Define tier ordering
  _tier_order := CASE _user_tier
    WHEN 'starter' THEN 1
    WHEN 'professional' THEN 2
    WHEN 'business' THEN 3
    ELSE 0
  END;
  
  _required_order := CASE _required_tier
    WHEN 'starter' THEN 1
    WHEN 'professional' THEN 2
    WHEN 'business' THEN 3
    ELSE 0
  END;
  
  RETURN _tier_order >= _required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update issue_invoice to validate template tier
CREATE OR REPLACE FUNCTION issue_invoice(_invoice_id UUID)
RETURNS invoices AS $$
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
  
  -- Get user profile and verify email
  SELECT * INTO _user_profile FROM profiles WHERE id = auth.uid();
  IF _user_profile IS NULL OR _user_profile.email_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Email must be verified before issuing invoices';
  END IF;
  
  -- Check tier limits
  SELECT check_tier_limit('invoices_per_month', auth.uid()) INTO _limit_check;
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
    RAISE EXCEPTION 'Business not found';
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
    issuer_snapshot = jsonb_build_object(
      'name', _business.name,
      'legal_name', _business.legal_name,
      'tax_id', _business.tax_id,
      'address', _business.address,
      'contact_email', _business.contact_email,
      'contact_phone', _business.contact_phone,
      'logo_url', _business.logo_url
    ),
    recipient_snapshot = jsonb_build_object(
      'name', _client.name,
      'email', _client.email,
      'phone', _client.phone,
      'tax_id', _client.tax_id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;