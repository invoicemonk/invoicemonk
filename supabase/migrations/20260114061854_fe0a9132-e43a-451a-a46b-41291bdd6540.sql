-- =============================================
-- PHASE 1: TIER ENFORCEMENT CORE
-- =============================================

-- Create tier_limits table for server-side enforcement
CREATE TABLE tier_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL,
  feature TEXT NOT NULL,
  limit_value INTEGER,
  limit_type TEXT NOT NULL DEFAULT 'count' CHECK (limit_type IN ('count', 'boolean', 'unlimited')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tier, feature)
);

-- Enable RLS
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

-- Everyone can read limits (needed for UI gating)
CREATE POLICY "Anyone can view tier limits"
  ON tier_limits FOR SELECT
  USING (true);

-- Only platform admins can modify
CREATE POLICY "Platform admins can manage tier limits"
  ON tier_limits FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Seed tier limits for STARTER (Free) tier - intentionally restrictive
INSERT INTO tier_limits (tier, feature, limit_value, limit_type, description) VALUES
  ('starter', 'invoices_per_month', 5, 'count', 'Maximum invoices per month'),
  ('starter', 'exports_enabled', 0, 'boolean', 'Data export functionality'),
  ('starter', 'reports_enabled', 0, 'boolean', 'Reports access'),
  ('starter', 'audit_logs_visible', 0, 'boolean', 'Audit logs visibility'),
  ('starter', 'verification_portal', 0, 'boolean', 'Invoice verification portal access'),
  ('starter', 'branding_allowed', 0, 'boolean', 'Custom branding on invoices'),
  ('starter', 'watermark_required', 1, 'boolean', 'Watermark on PDFs'),
  ('starter', 'premium_templates', 0, 'boolean', 'Premium template access');

-- Seed tier limits for PROFESSIONAL tier
INSERT INTO tier_limits (tier, feature, limit_value, limit_type, description) VALUES
  ('professional', 'invoices_per_month', NULL, 'unlimited', 'Unlimited invoices'),
  ('professional', 'exports_enabled', 1, 'boolean', 'Data export functionality'),
  ('professional', 'reports_enabled', 1, 'boolean', 'Reports access'),
  ('professional', 'audit_logs_visible', 1, 'boolean', 'Audit logs visibility'),
  ('professional', 'verification_portal', 1, 'boolean', 'Invoice verification portal access'),
  ('professional', 'branding_allowed', 1, 'boolean', 'Custom branding on invoices'),
  ('professional', 'watermark_required', 0, 'boolean', 'No watermark on PDFs'),
  ('professional', 'premium_templates', 1, 'boolean', 'Premium template access');

-- Seed tier limits for BUSINESS tier
INSERT INTO tier_limits (tier, feature, limit_value, limit_type, description) VALUES
  ('business', 'invoices_per_month', NULL, 'unlimited', 'Unlimited invoices'),
  ('business', 'exports_enabled', 1, 'boolean', 'Data export functionality'),
  ('business', 'reports_enabled', 1, 'boolean', 'Reports access'),
  ('business', 'audit_logs_visible', 1, 'boolean', 'Audit logs visibility'),
  ('business', 'verification_portal', 1, 'boolean', 'Invoice verification portal access'),
  ('business', 'branding_allowed', 1, 'boolean', 'Custom branding on invoices'),
  ('business', 'watermark_required', 0, 'boolean', 'No watermark on PDFs'),
  ('business', 'premium_templates', 1, 'boolean', 'Premium template access'),
  ('business', 'team_members', 10, 'count', 'Maximum team members'),
  ('business', 'api_access', 1, 'boolean', 'API access');

-- Create check_tier_limit function for server-side enforcement
CREATE OR REPLACE FUNCTION check_tier_limit(
  _user_id UUID,
  _feature TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscription RECORD;
  _limit RECORD;
  _current_count INTEGER;
  _tier subscription_tier;
BEGIN
  -- Get user's current subscription (default to starter if none)
  SELECT s.tier INTO _tier
  FROM subscriptions s
  WHERE s.user_id = _user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Default to starter if no active subscription
  IF _tier IS NULL THEN
    _tier := 'starter'::subscription_tier;
  END IF;
  
  -- Get limit for this tier + feature
  SELECT * INTO _limit
  FROM tier_limits
  WHERE tier = _tier
    AND feature = _feature;
  
  -- No limit defined = allowed
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'reason', 'no_limit_defined'
    );
  END IF;
  
  -- Boolean limits
  IF _limit.limit_type = 'boolean' THEN
    RETURN jsonb_build_object(
      'allowed', _limit.limit_value = 1,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'boolean',
      'reason', CASE WHEN _limit.limit_value = 1 THEN 'allowed' ELSE 'feature_disabled' END
    );
  END IF;
  
  -- Unlimited
  IF _limit.limit_type = 'unlimited' OR _limit.limit_value IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'unlimited',
      'reason', 'unlimited'
    );
  END IF;
  
  -- Count-based limits (invoices_per_month)
  IF _feature = 'invoices_per_month' THEN
    SELECT COUNT(*) INTO _current_count
    FROM invoices
    WHERE (user_id = _user_id OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = _user_id
    ))
    AND status != 'draft'
    AND issued_at >= date_trunc('month', CURRENT_DATE)
    AND issued_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
    
    RETURN jsonb_build_object(
      'allowed', _current_count < _limit.limit_value,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'count',
      'current_count', _current_count,
      'limit_value', _limit.limit_value,
      'remaining', GREATEST(0, _limit.limit_value - _current_count),
      'reason', CASE WHEN _current_count < _limit.limit_value THEN 'within_limit' ELSE 'limit_reached' END
    );
  END IF;
  
  -- team_members count
  IF _feature = 'team_members' THEN
    SELECT COUNT(*) INTO _current_count
    FROM business_members bm
    JOIN businesses b ON b.id = bm.business_id
    WHERE b.created_by = _user_id;
    
    RETURN jsonb_build_object(
      'allowed', _current_count < _limit.limit_value,
      'tier', _tier,
      'feature', _feature,
      'limit_type', 'count',
      'current_count', _current_count,
      'limit_value', _limit.limit_value,
      'remaining', GREATEST(0, _limit.limit_value - _current_count),
      'reason', CASE WHEN _current_count < _limit.limit_value THEN 'within_limit' ELSE 'limit_reached' END
    );
  END IF;
  
  -- Default: allowed
  RETURN jsonb_build_object(
    'allowed', true,
    'tier', _tier,
    'feature', _feature,
    'reason', 'default_allowed'
  );
END;
$$;

-- =============================================
-- PHASE 2: TEMPLATE SYSTEM
-- =============================================

-- Create invoice_templates table
CREATE TABLE invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tier_required subscription_tier NOT NULL DEFAULT 'starter',
  layout JSONB NOT NULL DEFAULT '{
    "header_style": "standard",
    "show_logo": true,
    "show_issuer_details": true,
    "show_recipient_details": true,
    "show_line_items": true,
    "show_totals": true,
    "show_notes": true,
    "show_terms": true,
    "show_verification_qr": true
  }'::jsonb,
  styles JSONB DEFAULT '{
    "primary_color": "#000000",
    "font_family": "Inter",
    "font_size": "12px"
  }'::jsonb,
  supports_branding BOOLEAN DEFAULT false,
  watermark_required BOOLEAN DEFAULT true,
  preview_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view active templates
CREATE POLICY "Anyone can view active templates"
  ON invoice_templates FOR SELECT
  USING (is_active = true);

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can manage templates"
  ON invoice_templates FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Add template columns to invoices
ALTER TABLE invoices 
  ADD COLUMN template_id UUID REFERENCES invoice_templates(id),
  ADD COLUMN template_snapshot JSONB;

-- Seed default templates
INSERT INTO invoice_templates (name, description, tier_required, supports_branding, watermark_required, sort_order, layout, styles) VALUES
  (
    'Basic', 
    'Simple invoice layout for getting started. Includes Invoicemonk watermark.', 
    'starter', 
    false, 
    true, 
    1,
    '{"header_style": "minimal", "show_logo": false, "show_issuer_details": true, "show_recipient_details": true, "show_line_items": true, "show_totals": true, "show_notes": true, "show_terms": false, "show_verification_qr": false}'::jsonb,
    '{"primary_color": "#6B7280", "font_family": "Inter", "font_size": "12px"}'::jsonb
  ),
  (
    'Professional', 
    'Clean, professional layout with full branding support and verification QR.', 
    'professional', 
    true, 
    false, 
    2,
    '{"header_style": "standard", "show_logo": true, "show_issuer_details": true, "show_recipient_details": true, "show_line_items": true, "show_totals": true, "show_notes": true, "show_terms": true, "show_verification_qr": true}'::jsonb,
    '{"primary_color": "#1F2937", "font_family": "Inter", "font_size": "12px"}'::jsonb
  ),
  (
    'Modern', 
    'Contemporary design with emphasis on clarity and visual hierarchy.', 
    'professional', 
    true, 
    false, 
    3,
    '{"header_style": "modern", "show_logo": true, "show_issuer_details": true, "show_recipient_details": true, "show_line_items": true, "show_totals": true, "show_notes": true, "show_terms": true, "show_verification_qr": true}'::jsonb,
    '{"primary_color": "#4F46E5", "font_family": "Inter", "font_size": "13px"}'::jsonb
  ),
  (
    'Enterprise', 
    'Full-featured layout with custom sections, designed for large organizations.', 
    'business', 
    true, 
    false, 
    4,
    '{"header_style": "enterprise", "show_logo": true, "show_issuer_details": true, "show_recipient_details": true, "show_line_items": true, "show_totals": true, "show_notes": true, "show_terms": true, "show_verification_qr": true, "show_payment_instructions": true, "show_bank_details": true}'::jsonb,
    '{"primary_color": "#111827", "font_family": "Inter", "font_size": "12px"}'::jsonb
  );

-- =============================================
-- PHASE 3: CURRENCY LOCKING
-- =============================================

-- Add currency locking fields to businesses
ALTER TABLE businesses 
  ADD COLUMN default_currency TEXT,
  ADD COLUMN currency_locked BOOLEAN DEFAULT false,
  ADD COLUMN currency_locked_at TIMESTAMPTZ;

-- Add currency lock timestamp to invoices
ALTER TABLE invoices 
  ADD COLUMN currency_locked_at TIMESTAMPTZ;

-- Create function to lock business currency on first issued invoice
CREATE OR REPLACE FUNCTION lock_business_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When an invoice is issued (status changes from draft to issued)
  IF NEW.status = 'issued' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    -- Set currency lock timestamp on invoice
    NEW.currency_locked_at := now();
    
    -- Lock business currency if not already locked
    IF NEW.business_id IS NOT NULL THEN
      UPDATE businesses
      SET 
        default_currency = COALESCE(default_currency, NEW.currency),
        currency_locked = true,
        currency_locked_at = COALESCE(currency_locked_at, now())
      WHERE id = NEW.business_id
        AND (currency_locked = false OR currency_locked IS NULL);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for currency locking
CREATE TRIGGER trigger_lock_business_currency
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION lock_business_currency();

-- Create function to prevent currency changes
CREATE OR REPLACE FUNCTION prevent_currency_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _business_currency TEXT;
  _currency_locked BOOLEAN;
BEGIN
  -- Prevent currency change on issued invoices
  IF OLD.status != 'draft' AND NEW.currency != OLD.currency THEN
    RAISE EXCEPTION 'Cannot change currency on issued invoice. Currency is immutable after issuance.';
  END IF;
  
  -- For draft invoices, check if business currency is locked
  IF NEW.status = 'draft' AND NEW.business_id IS NOT NULL THEN
    SELECT default_currency, currency_locked 
    INTO _business_currency, _currency_locked
    FROM businesses WHERE id = NEW.business_id;
    
    IF _currency_locked = true AND _business_currency IS NOT NULL AND NEW.currency != _business_currency THEN
      RAISE EXCEPTION 'Business currency is locked to %. All invoices must use this currency.', _business_currency;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for preventing currency changes
CREATE TRIGGER trigger_prevent_currency_change
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_currency_change();

-- =============================================
-- UPDATE ISSUE_INVOICE FUNCTION
-- =============================================

-- Drop and recreate the issue_invoice function with tier checks and template snapshots
CREATE OR REPLACE FUNCTION issue_invoice(_invoice_id UUID)
RETURNS invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _business businesses%ROWTYPE;
  _client clients%ROWTYPE;
  _tax_schema tax_schemas%ROWTYPE;
  _template invoice_templates%ROWTYPE;
  _retention_policy retention_policies%ROWTYPE;
  _tier_check JSONB;
  _user_tier subscription_tier;
  _verification_id TEXT;
  _invoice_hash TEXT;
  _retention_until TIMESTAMPTZ;
BEGIN
  -- Fetch the invoice
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;
  
  -- CHECK TIER LIMITS FIRST (Server-side enforcement)
  _tier_check := check_tier_limit(_invoice.user_id, 'invoices_per_month');
  
  IF NOT (_tier_check->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'Invoice limit reached. You have issued % of % invoices this month. Upgrade to Professional for unlimited invoices.',
      _tier_check->>'current_count',
      _tier_check->>'limit_value';
  END IF;
  
  -- Get user's tier for template validation
  SELECT COALESCE(s.tier, 'starter'::subscription_tier) INTO _user_tier
  FROM subscriptions s
  WHERE s.user_id = _invoice.user_id AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  IF _user_tier IS NULL THEN
    _user_tier := 'starter'::subscription_tier;
  END IF;
  
  -- Fetch the business for issuer snapshot
  IF _invoice.business_id IS NOT NULL THEN
    SELECT * INTO _business FROM businesses WHERE id = _invoice.business_id;
  END IF;
  
  -- Fetch the client for recipient snapshot
  SELECT * INTO _client FROM clients WHERE id = _invoice.client_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;
  
  -- Fetch tax schema if set
  IF _invoice.tax_schema_id IS NOT NULL THEN
    SELECT * INTO _tax_schema FROM tax_schemas WHERE id = _invoice.tax_schema_id;
  END IF;
  
  -- Fetch template (use selected or default for tier)
  IF _invoice.template_id IS NOT NULL THEN
    SELECT * INTO _template FROM invoice_templates WHERE id = _invoice.template_id AND is_active = true;
    
    -- Validate template tier requirement
    IF FOUND THEN
      -- Check if user's tier allows this template
      IF (_template.tier_required = 'business' AND _user_tier NOT IN ('business')) OR
         (_template.tier_required = 'professional' AND _user_tier = 'starter') THEN
        -- Fall back to default template for their tier
        SELECT * INTO _template 
        FROM invoice_templates 
        WHERE tier_required = _user_tier AND is_active = true 
        ORDER BY sort_order LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  -- If no template selected or found, get default for tier
  IF _template.id IS NULL THEN
    SELECT * INTO _template 
    FROM invoice_templates 
    WHERE tier_required = _user_tier AND is_active = true 
    ORDER BY sort_order LIMIT 1;
    
    -- Fallback to starter template
    IF NOT FOUND THEN
      SELECT * INTO _template 
      FROM invoice_templates 
      WHERE tier_required = 'starter' AND is_active = true 
      ORDER BY sort_order LIMIT 1;
    END IF;
  END IF;
  
  -- Fetch retention policy
  SELECT * INTO _retention_policy 
  FROM retention_policies 
  WHERE jurisdiction = COALESCE(_business.jurisdiction, 'DEFAULT')
    AND entity_type = 'invoice'
  LIMIT 1;
  
  -- Default retention if no policy found
  IF NOT FOUND THEN
    SELECT * INTO _retention_policy 
    FROM retention_policies 
    WHERE jurisdiction = 'DEFAULT' AND entity_type = 'invoice'
    LIMIT 1;
  END IF;
  
  -- Calculate retention until date
  _retention_until := now() + (COALESCE(_retention_policy.retention_years, 7) || ' years')::INTERVAL;
  
  -- Generate verification ID
  _verification_id := 'INV-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || _invoice_id::TEXT || NOW()::TEXT) FROM 1 FOR 12));
  
  -- Generate invoice hash (for integrity verification)
  _invoice_hash := MD5(
    _invoice.invoice_number || 
    _invoice.total_amount::TEXT || 
    _invoice.currency ||
    _client.name ||
    COALESCE(_business.name, '') ||
    NOW()::TEXT
  );
  
  -- Update the invoice with all snapshots and compliance data
  UPDATE invoices SET
    status = 'issued',
    issued_at = now(),
    issued_by = auth.uid(),
    issue_date = CURRENT_DATE,
    verification_id = _verification_id,
    invoice_hash = _invoice_hash,
    retention_locked_until = _retention_until,
    currency_locked_at = now(),
    template_id = _template.id,
    template_snapshot = CASE 
      WHEN _template.id IS NOT NULL THEN jsonb_build_object(
        'id', _template.id,
        'name', _template.name,
        'tier_required', _template.tier_required,
        'layout', _template.layout,
        'styles', _template.styles,
        'supports_branding', _template.supports_branding,
        'watermark_required', _template.watermark_required
      )
      ELSE NULL
    END,
    issuer_snapshot = CASE 
      WHEN _business.id IS NOT NULL THEN jsonb_build_object(
        'id', _business.id,
        'name', _business.name,
        'legal_name', _business.legal_name,
        'tax_id', _business.tax_id,
        'address', _business.address,
        'contact_email', _business.contact_email,
        'contact_phone', _business.contact_phone,
        'jurisdiction', _business.jurisdiction
      )
      ELSE NULL
    END,
    recipient_snapshot = jsonb_build_object(
      'id', _client.id,
      'name', _client.name,
      'email', _client.email,
      'phone', _client.phone,
      'address', _client.address,
      'tax_id', _client.tax_id
    ),
    tax_schema_snapshot = CASE 
      WHEN _tax_schema.id IS NOT NULL THEN jsonb_build_object(
        'id', _tax_schema.id,
        'name', _tax_schema.name,
        'version', _tax_schema.version,
        'jurisdiction', _tax_schema.jurisdiction,
        'rates', _tax_schema.rates,
        'rules', _tax_schema.rules
      )
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = _invoice_id
  RETURNING * INTO _invoice;
  
  -- Log the audit event
  PERFORM log_audit_event(
    _entity_type := 'invoice',
    _entity_id := _invoice_id::TEXT,
    _event_type := 'INVOICE_ISSUED'::audit_event_type,
    _user_id := auth.uid(),
    _business_id := _invoice.business_id,
    _new_state := to_jsonb(_invoice),
    _metadata := jsonb_build_object(
      'verification_id', _verification_id,
      'invoice_hash', _invoice_hash,
      'template_name', _template.name,
      'tier', _user_tier,
      'retention_until', _retention_until
    )
  );
  
  RETURN _invoice;
END;
$$;