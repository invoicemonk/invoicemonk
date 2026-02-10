
-- ============================================================
-- Partner Referral Program: Full Schema Migration
-- ============================================================

-- 1. New Enums
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'partner';

CREATE TYPE partner_status AS ENUM ('active', 'paused', 'suspended');
CREATE TYPE commission_status AS ENUM ('pending', 'locked', 'paid', 'voided');
CREATE TYPE payout_batch_status AS ENUM ('draft', 'processing', 'paid', 'cancelled');

-- New audit event types
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'PARTNER_CREATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'PARTNER_UPDATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'COMMISSION_CREATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'COMMISSION_LOCKED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'COMMISSION_VOIDED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'PAYOUT_CREATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'PAYOUT_PAID';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'REFERRAL_ATTRIBUTED';

-- 2. Customer ref sequence
CREATE SEQUENCE IF NOT EXISTS referral_customer_ref_seq START 10001;

-- 3. Tables
-- referral_partners
CREATE TABLE public.referral_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  payout_method TEXT,
  payout_details JSONB,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  status partner_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_partners_user_id_unique UNIQUE (user_id)
);

-- referral_links
CREATE TABLE public.referral_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  landing_page TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_links_code_unique UNIQUE (code)
);

-- referral_clicks
CREATE TABLE public.referral_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referrer_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_clicks_link_id ON public.referral_clicks(link_id);
CREATE INDEX idx_referral_clicks_visitor_id ON public.referral_clicks(visitor_id);

-- referrals
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  link_id UUID REFERENCES public.referral_links(id),
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id),
  commission_business_id UUID REFERENCES public.businesses(id),
  customer_ref TEXT NOT NULL,
  first_click_at TIMESTAMPTZ NOT NULL,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_self_referral BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referrals_referred_user_unique UNIQUE (referred_user_id)
);

CREATE INDEX idx_referrals_partner_id ON public.referrals(partner_id);

-- payout_batches (created before commissions so FK works)
CREATE TABLE public.payout_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status payout_batch_status NOT NULL DEFAULT 'draft',
  payment_reference TEXT,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- commissions
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.referrals(id),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
  billing_event_id TEXT NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  status commission_status NOT NULL DEFAULT 'pending',
  locked_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_batch_id UUID REFERENCES public.payout_batches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commissions_billing_event_unique UNIQUE (billing_event_id)
);

CREATE INDEX idx_commissions_partner_id ON public.commissions(partner_id);
CREATE INDEX idx_commissions_referral_id ON public.commissions(referral_id);
CREATE INDEX idx_commissions_status ON public.commissions(status);

-- 4. updated_at triggers
CREATE TRIGGER update_referral_partners_updated_at
  BEFORE UPDATE ON public.referral_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Self-referral detection trigger
CREATE OR REPLACE FUNCTION public.detect_self_referral()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _partner_user_id UUID;
BEGIN
  SELECT user_id INTO _partner_user_id
  FROM referral_partners WHERE id = NEW.partner_id;
  
  IF _partner_user_id = NEW.referred_user_id THEN
    NEW.is_self_referral := true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_self_referral
  BEFORE INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.detect_self_referral();

-- 6. Immutable referral attribution trigger
CREATE OR REPLACE FUNCTION public.prevent_referral_reassignment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Block changes to referred_user_id always
  IF OLD.referred_user_id IS DISTINCT FROM NEW.referred_user_id THEN
    RAISE EXCEPTION 'Cannot change referred_user_id on a referral record';
  END IF;
  
  -- Block changes to partner_id unless caller is platform_admin
  IF OLD.partner_id IS DISTINCT FROM NEW.partner_id THEN
    IF NOT has_role(auth.uid(), 'platform_admin') THEN
      RAISE EXCEPTION 'Only platform admins can reassign referral partner ownership';
    END IF;
  END IF;
  
  -- Block changes to commission_business_id once set (unless admin)
  IF OLD.commission_business_id IS NOT NULL 
     AND OLD.commission_business_id IS DISTINCT FROM NEW.commission_business_id THEN
    IF NOT has_role(auth.uid(), 'platform_admin') THEN
      RAISE EXCEPTION 'Commission business is locked and cannot be changed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_referral_reassignment
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_referral_reassignment();

-- 7. Payout batch currency integrity trigger
CREATE OR REPLACE FUNCTION public.validate_commission_payout_currency()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _batch_currency TEXT;
BEGIN
  IF NEW.payout_batch_id IS NOT NULL THEN
    SELECT currency INTO _batch_currency
    FROM payout_batches WHERE id = NEW.payout_batch_id;
    
    IF _batch_currency IS NOT NULL AND NEW.currency != _batch_currency THEN
      RAISE EXCEPTION 'Commission currency (%) does not match payout batch currency (%)',
        NEW.currency, _batch_currency;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_commission_payout_currency
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_commission_payout_currency();

-- 8. Prevent commission deletion (audit immutability)
CREATE OR REPLACE FUNCTION public.prevent_commission_deletion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Commission records are immutable and cannot be deleted';
END;
$$;

CREATE TRIGGER trg_prevent_commission_deletion
  BEFORE DELETE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_commission_deletion();

-- 9. RLS
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

-- referral_partners RLS
CREATE POLICY "Partners can view own profile"
  ON public.referral_partners FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Admins can insert partners"
  ON public.referral_partners FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Admins can update partners"
  ON public.referral_partners FOR UPDATE
  USING (has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Partners can update own payout details"
  ON public.referral_partners FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete partners"
  ON public.referral_partners FOR DELETE
  USING (has_role(auth.uid(), 'platform_admin'));

-- referral_links RLS
CREATE POLICY "Partners can view own links"
  ON public.referral_links FOR SELECT
  USING (
    partner_id IN (SELECT id FROM referral_partners WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Partners can create own links"
  ON public.referral_links FOR INSERT
  WITH CHECK (
    partner_id IN (SELECT id FROM referral_partners WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Partners can update own links"
  ON public.referral_links FOR UPDATE
  USING (
    partner_id IN (SELECT id FROM referral_partners WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins can delete links"
  ON public.referral_links FOR DELETE
  USING (has_role(auth.uid(), 'platform_admin'));

-- referral_clicks RLS (admin only SELECT, edge function writes via service role)
CREATE POLICY "Admins can view clicks"
  ON public.referral_clicks FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

-- referrals RLS
CREATE POLICY "Partners can view own referrals"
  ON public.referrals FOR SELECT
  USING (
    partner_id IN (SELECT id FROM referral_partners WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins can manage referrals"
  ON public.referrals FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));

-- commissions RLS
CREATE POLICY "Partners can view own commissions"
  ON public.commissions FOR SELECT
  USING (
    partner_id IN (SELECT id FROM referral_partners WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins can manage commissions"
  ON public.commissions FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));

-- payout_batches RLS
CREATE POLICY "Partners can view own payouts"
  ON public.payout_batches FOR SELECT
  USING (
    partner_id IN (SELECT id FROM referral_partners WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins can manage payouts"
  ON public.payout_batches FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));
