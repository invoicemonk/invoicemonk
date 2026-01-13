-- =============================================
-- INVOICEMONK v2.0 - COMPLIANCE-FIRST SCHEMA
-- Phase 1: Database Foundation
-- =============================================

-- 1. ENUM TYPES
-- =============================================

-- Invoice lifecycle states
CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'issued',
  'sent',
  'viewed',
  'paid',
  'voided',
  'credited'
);

-- Audit event types for comprehensive logging
CREATE TYPE public.audit_event_type AS ENUM (
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_SIGNUP',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET',
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_ISSUED',
  'INVOICE_SENT',
  'INVOICE_VIEWED',
  'INVOICE_VOIDED',
  'INVOICE_CREDITED',
  'PAYMENT_RECORDED',
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'BUSINESS_CREATED',
  'BUSINESS_UPDATED',
  'TEAM_MEMBER_ADDED',
  'TEAM_MEMBER_REMOVED',
  'ROLE_CHANGED',
  'DATA_EXPORTED',
  'SUBSCRIPTION_CHANGED',
  'SETTINGS_UPDATED'
);

-- Subscription tiers
CREATE TYPE public.subscription_tier AS ENUM (
  'starter',
  'professional',
  'business'
);

-- Subscription status
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'cancelled',
  'past_due',
  'trialing'
);

-- Business member roles (distinct from app_role)
CREATE TYPE public.business_role AS ENUM (
  'owner',
  'admin',
  'member',
  'auditor'
);

-- 2. CORE TABLES
-- =============================================

-- Businesses (Organizations)
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  jurisdiction TEXT NOT NULL DEFAULT 'NG',
  tax_id TEXT,
  address JSONB,
  contact_email TEXT,
  contact_phone TEXT,
  logo_url TEXT,
  invoice_prefix TEXT DEFAULT 'INV',
  next_invoice_number INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Members (User-Business relationship)
CREATE TABLE public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role public.business_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, business_id)
);

-- Clients (Invoice Recipients)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB,
  tax_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_owner_check CHECK (
    (user_id IS NOT NULL AND business_id IS NULL) OR
    (user_id IS NULL AND business_id IS NOT NULL)
  )
);

-- Invoices (Core - with immutability enforcement)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  
  -- Financial data
  currency TEXT NOT NULL DEFAULT 'NGN',
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Dates
  issue_date DATE,
  due_date DATE,
  
  -- Metadata
  notes TEXT,
  terms TEXT,
  
  -- Compliance fields (set on issue)
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_hash TEXT,
  verification_id UUID UNIQUE,
  
  -- Voiding/Credit info
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT invoice_owner_check CHECK (
    (user_id IS NOT NULL AND business_id IS NULL) OR
    (user_id IS NULL AND business_id IS NOT NULL)
  )
);

-- Invoice Items (Line items)
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit Notes (For voiding/crediting invoices)
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL,
  original_invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  credit_note_hash TEXT,
  verification_id UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs (Immutable, append-only)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.audit_event_type NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_ip INET,
  user_agent TEXT,
  previous_state JSONB,
  new_state JSONB,
  metadata JSONB,
  event_hash TEXT
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  tier public.subscription_tier NOT NULL DEFAULT 'starter',
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_owner_check CHECK (
    (user_id IS NOT NULL AND business_id IS NULL) OR
    (user_id IS NULL AND business_id IS NOT NULL)
  )
);

-- 3. INDEXES
-- =============================================

CREATE INDEX idx_businesses_created_by ON public.businesses(created_by);
CREATE INDEX idx_business_members_user_id ON public.business_members(user_id);
CREATE INDEX idx_business_members_business_id ON public.business_members(business_id);
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_clients_business_id ON public.clients(business_id);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_business_id ON public.invoices(business_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_verification_id ON public.invoices(verification_id);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_credit_notes_original_invoice ON public.credit_notes(original_invoice_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_business ON public.audit_logs(business_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp_utc DESC);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);

-- 4. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is member of a business
CREATE OR REPLACE FUNCTION public.is_business_member(_user_id UUID, _business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id AND business_id = _business_id
  )
$$;

-- Helper function: Check business role
CREATE OR REPLACE FUNCTION public.has_business_role(_user_id UUID, _business_id UUID, _role business_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id 
      AND business_id = _business_id 
      AND role = _role
  )
$$;

-- BUSINESSES policies
CREATE POLICY "Users can view businesses they belong to"
  ON public.businesses FOR SELECT
  USING (public.is_business_member(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Users can create businesses"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Business owners/admins can update"
  ON public.businesses FOR UPDATE
  USING (
    public.has_business_role(auth.uid(), id, 'owner') OR
    public.has_business_role(auth.uid(), id, 'admin')
  );

-- BUSINESS_MEMBERS policies
CREATE POLICY "Members can view their business memberships"
  ON public.business_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Business owners/admins can manage members"
  ON public.business_members FOR INSERT
  WITH CHECK (
    public.has_business_role(auth.uid(), business_id, 'owner') OR
    public.has_business_role(auth.uid(), business_id, 'admin')
  );

CREATE POLICY "Business owners/admins can update members"
  ON public.business_members FOR UPDATE
  USING (
    public.has_business_role(auth.uid(), business_id, 'owner') OR
    public.has_business_role(auth.uid(), business_id, 'admin')
  );

CREATE POLICY "Business owners can remove members"
  ON public.business_members FOR DELETE
  USING (public.has_business_role(auth.uid(), business_id, 'owner'));

-- CLIENTS policies
CREATE POLICY "Users can view their own clients"
  ON public.clients FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Users can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Users can update their clients"
  ON public.clients FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (public.has_business_role(auth.uid(), business_id, 'owner') OR
     public.has_business_role(auth.uid(), business_id, 'admin'))
  );

-- INVOICES policies
CREATE POLICY "Users can view their invoices"
  ON public.invoices FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Users can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Users can update draft invoices only"
  ON public.invoices FOR UPDATE
  USING (
    status = 'draft' AND
    (user_id = auth.uid() OR public.is_business_member(auth.uid(), business_id))
  );

-- INVOICE_ITEMS policies
CREATE POLICY "Users can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
    )
  );

CREATE POLICY "Users can manage draft invoice items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND i.status = 'draft'
      AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
    )
  );

CREATE POLICY "Users can update draft invoice items"
  ON public.invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND i.status = 'draft'
      AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
    )
  );

CREATE POLICY "Users can delete draft invoice items"
  ON public.invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND i.status = 'draft'
      AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
    )
  );

-- CREDIT_NOTES policies
CREATE POLICY "Users can view their credit notes"
  ON public.credit_notes FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

CREATE POLICY "Users can create credit notes"
  ON public.credit_notes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

-- PAYMENTS policies
CREATE POLICY "Users can view payments for their invoices"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
    )
  );

CREATE POLICY "Users can record payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
    )
  );

-- AUDIT_LOGS policies (READ-ONLY, NO UPDATE/DELETE)
CREATE POLICY "Users can view their audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id) OR
    actor_id = auth.uid()
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (TRUE);

-- NO UPDATE OR DELETE POLICIES FOR AUDIT_LOGS - IMMUTABLE

-- SUBSCRIPTIONS policies
CREATE POLICY "Users can view their subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_business_member(auth.uid(), business_id)
  );

-- Platform admins can manage all
CREATE POLICY "Platform admins can manage businesses"
  ON public.businesses FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Platform admins can view all invoices"
  ON public.invoices FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Platform admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- 5. IMMUTABILITY TRIGGERS
-- =============================================

-- Prevent modification of issued invoices
CREATE OR REPLACE FUNCTION public.prevent_invoice_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow status transitions and payment updates
  IF OLD.status != 'draft' THEN
    -- Only allow specific field updates after issuance
    IF (
      OLD.invoice_number != NEW.invoice_number OR
      OLD.client_id != NEW.client_id OR
      OLD.subtotal != NEW.subtotal OR
      OLD.tax_amount != NEW.tax_amount OR
      OLD.discount_amount != NEW.discount_amount OR
      OLD.total_amount != NEW.total_amount OR
      OLD.currency != NEW.currency OR
      OLD.issue_date != NEW.issue_date OR
      OLD.issued_at != NEW.issued_at OR
      OLD.invoice_hash != NEW.invoice_hash
    ) THEN
      RAISE EXCEPTION 'Cannot modify issued invoice. Financial data is immutable.';
    END IF;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_invoice_modification_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoice_modification();

-- Prevent deletion of invoices (soft delete only via voiding)
CREATE OR REPLACE FUNCTION public.prevent_invoice_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status != 'draft' THEN
    RAISE EXCEPTION 'Cannot delete issued invoice. Use void operation instead.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_invoice_deletion_trigger
  BEFORE DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoice_deletion();

-- Prevent modification of invoice items after invoice is issued
CREATE OR REPLACE FUNCTION public.prevent_invoice_item_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_status invoice_status;
BEGIN
  SELECT status INTO invoice_status FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  IF invoice_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot modify items of issued invoice.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER prevent_invoice_item_modification_trigger
  BEFORE UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoice_item_modification();

-- Prevent any modification to audit logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted.';
END;
$$;

CREATE TRIGGER prevent_audit_log_modification_trigger
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 6. AUDIT LOGGING FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _event_type audit_event_type,
  _entity_type TEXT,
  _entity_id UUID DEFAULT NULL,
  _user_id UUID DEFAULT NULL,
  _business_id UUID DEFAULT NULL,
  _previous_state JSONB DEFAULT NULL,
  _new_state JSONB DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
  _actor_role TEXT;
BEGIN
  -- Get actor's role
  SELECT role::TEXT INTO _actor_role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  INSERT INTO public.audit_logs (
    event_type,
    entity_type,
    entity_id,
    actor_id,
    actor_role,
    user_id,
    business_id,
    previous_state,
    new_state,
    metadata,
    event_hash
  ) VALUES (
    _event_type,
    _entity_type,
    _entity_id,
    auth.uid(),
    _actor_role,
    COALESCE(_user_id, auth.uid()),
    _business_id,
    _previous_state,
    _new_state,
    _metadata,
    encode(sha256(
      (_event_type::TEXT || _entity_type || COALESCE(_entity_id::TEXT, '') || now()::TEXT)::BYTEA
    ), 'hex')
  )
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;

-- 7. INVOICE ISSUANCE FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id UUID)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice public.invoices;
  _invoice_hash TEXT;
  _verification_id UUID;
BEGIN
  -- Get invoice
  SELECT * INTO _invoice FROM public.invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued';
  END IF;
  
  -- Generate hash for tamper detection
  _invoice_hash := encode(sha256(
    (_invoice.id::TEXT || 
     _invoice.invoice_number || 
     _invoice.total_amount::TEXT || 
     _invoice.client_id::TEXT || 
     now()::TEXT)::BYTEA
  ), 'hex');
  
  _verification_id := gen_random_uuid();
  
  -- Update invoice to issued
  UPDATE public.invoices
  SET 
    status = 'issued',
    issued_at = now(),
    issued_by = auth.uid(),
    issue_date = COALESCE(issue_date, CURRENT_DATE),
    invoice_hash = _invoice_hash,
    verification_id = _verification_id
  WHERE id = _invoice_id
  RETURNING * INTO _invoice;
  
  -- Log audit event
  PERFORM public.log_audit_event(
    'INVOICE_ISSUED'::audit_event_type,
    'invoice',
    _invoice_id,
    _invoice.user_id,
    _invoice.business_id,
    NULL,
    to_jsonb(_invoice),
    jsonb_build_object('verification_id', _verification_id)
  );
  
  RETURN _invoice;
END;
$$;

-- 8. HELPER TRIGGERS
-- =============================================

-- Auto-add creator as business owner
CREATE OR REPLACE FUNCTION public.add_business_creator_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_members (user_id, business_id, role, accepted_at)
  VALUES (NEW.created_by, NEW.id, 'owner', now());
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_business_creator_as_owner_trigger
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.add_business_creator_as_owner();

-- Update timestamps
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();