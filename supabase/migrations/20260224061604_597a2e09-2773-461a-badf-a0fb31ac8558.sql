
-- Step 1: Add cooldown columns to user_activity_state
ALTER TABLE public.user_activity_state
  ADD COLUMN IF NOT EXISTS last_inactivity_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_abandoned_draft_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_weekly_summary_email_at timestamptz;

-- Step 2: Create compliance_risks table
CREATE TABLE public.compliance_risks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid,
  risk_type text NOT NULL,
  risk_severity text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_risks_invoice ON public.compliance_risks (invoice_id);
CREATE INDEX idx_compliance_risks_user ON public.compliance_risks (user_id, created_at DESC);

ALTER TABLE public.compliance_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compliance risks"
  ON public.compliance_risks FOR SELECT
  USING (auth.uid() = user_id OR is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage compliance risks"
  ON public.compliance_risks FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Step 3: Add lifecycle_events index for campaign cooldown queries
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_campaign_cooldown
  ON public.lifecycle_events (user_id, event_type, created_at DESC);

-- Step 4: Draft invoice creation trigger
CREATE OR REPLACE FUNCTION public.on_invoice_created_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'draft' THEN
    INSERT INTO public.lifecycle_events (user_id, event_type, metadata)
    VALUES (
      NEW.user_id,
      'draft_created',
      jsonb_build_object('invoice_id', NEW.id, 'business_id', NEW.business_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_invoice_created_lifecycle
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invoice_created_lifecycle();
