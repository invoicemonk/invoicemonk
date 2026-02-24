
-- =============================================
-- Lifecycle Engagement System: Tables & Triggers
-- =============================================

-- Table 1: lifecycle_events (append-only event log)
CREATE TABLE public.lifecycle_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for cap-check queries
CREATE INDEX idx_lifecycle_events_user_type ON public.lifecycle_events (user_id, event_type);

-- RLS: users can read their own events; inserts are service-role only
ALTER TABLE public.lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lifecycle events"
  ON public.lifecycle_events FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for regular users (service role only)

-- Table 2: user_activity_state (one row per user, upsertable)
CREATE TABLE public.user_activity_state (
  user_id uuid NOT NULL PRIMARY KEY,
  last_login_at timestamptz,
  total_invoices integer NOT NULL DEFAULT 0,
  last_invoice_at timestamptz,
  overdue_count integer NOT NULL DEFAULT 0,
  email_verified boolean NOT NULL DEFAULT false,
  last_unverified_email_at timestamptz,
  last_first_invoice_email_at timestamptz,
  last_overdue_email_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity state"
  ON public.user_activity_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity state"
  ON public.user_activity_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity state"
  ON public.user_activity_state FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- Trigger 1: Bootstrap user_activity_state on profile creation
-- =============================================
CREATE OR REPLACE FUNCTION public.bootstrap_user_activity_state()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_activity_state (user_id, email_verified)
  VALUES (NEW.id, COALESCE(NEW.email_verified, false))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_bootstrap_activity_state
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_user_activity_state();

-- =============================================
-- Trigger 2: On invoice status -> 'issued', increment counter + log event
-- =============================================
CREATE OR REPLACE FUNCTION public.on_invoice_issued_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status transitions TO 'issued'
  IF NEW.status = 'issued' AND (OLD.status IS DISTINCT FROM 'issued') THEN
    -- Increment total_invoices counter
    UPDATE public.user_activity_state
    SET total_invoices = total_invoices + 1,
        last_invoice_at = now(),
        updated_at = now()
    WHERE user_id = NEW.user_id;

    -- Log lifecycle event
    INSERT INTO public.lifecycle_events (user_id, event_type, metadata)
    VALUES (
      NEW.user_id,
      'invoice_issued',
      jsonb_build_object(
        'invoice_id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'business_id', NEW.business_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_invoice_issued_lifecycle
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invoice_issued_lifecycle();

-- =============================================
-- Trigger 3: On email_verified -> true, update activity state
-- =============================================
CREATE OR REPLACE FUNCTION public.on_email_verified_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_verified = true AND (OLD.email_verified IS DISTINCT FROM true) THEN
    UPDATE public.user_activity_state
    SET email_verified = true,
        updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_email_verified_lifecycle
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_email_verified_lifecycle();
