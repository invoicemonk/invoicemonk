-- Phase 1.1: Fix Audit Logs RLS Gap
-- Drop the permissive policy that bypasses tier check
DROP POLICY IF EXISTS "Users can view their audit logs" ON audit_logs;

-- Phase 1.3: Fix Function Search Path Security
-- Add SET search_path TO 'public' to vulnerable functions
CREATE OR REPLACE FUNCTION public.compute_business_compliance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.compliance_status := CASE
    WHEN NEW.name IS NOT NULL 
      AND NEW.legal_name IS NOT NULL
      AND NEW.tax_id IS NOT NULL
      AND NEW.contact_email IS NOT NULL
      AND NEW.address IS NOT NULL
      AND (NEW.address->>'city') IS NOT NULL
      AND (NEW.address->>'country') IS NOT NULL
    THEN 'complete'
    ELSE 'incomplete'
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Phase 5.1: Add SLA Flags to Subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS priority_support BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sla_response_hours INTEGER;