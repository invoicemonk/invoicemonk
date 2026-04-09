
-- Create fraud_flags table for tracking suspicious payment activity
CREATE TABLE public.fraud_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  user_id UUID,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all fraud flags
CREATE POLICY "Platform admins can manage fraud flags"
  ON public.fraud_flags
  FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Business members can view their own flags
CREATE POLICY "Business members can view their fraud flags"
  ON public.fraud_flags
  FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

-- Index for common queries
CREATE INDEX idx_fraud_flags_business_id ON public.fraud_flags(business_id);
CREATE INDEX idx_fraud_flags_resolved ON public.fraud_flags(resolved);
CREATE INDEX idx_fraud_flags_severity ON public.fraud_flags(severity);

-- Add SELF_PAYMENT_BLOCKED and PAYMENT_FLAGGED to audit_event_type enum
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'SELF_PAYMENT_BLOCKED';
ALTER TYPE public.audit_event_type ADD VALUE IF NOT EXISTS 'PAYMENT_FLAGGED';
