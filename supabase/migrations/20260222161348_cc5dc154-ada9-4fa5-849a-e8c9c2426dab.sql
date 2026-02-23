
-- Phase 1.1: Extend compliance_artifacts with XML columns
ALTER TABLE compliance_artifacts
  ADD COLUMN IF NOT EXISTS xml_content TEXT NULL,
  ADD COLUMN IF NOT EXISTS xml_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS xml_generated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS schema_version TEXT NULL;

-- Replace blanket immutability trigger with smarter version
DROP TRIGGER IF EXISTS prevent_artifact_modification ON compliance_artifacts;
DROP FUNCTION IF EXISTS prevent_artifact_modification();

CREATE OR REPLACE FUNCTION enforce_artifact_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Compliance artifacts are immutable and cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Allow one-time write of xml_content when it was previously NULL
    IF OLD.xml_content IS NULL AND NEW.xml_content IS NOT NULL THEN
      -- Ensure no other columns are being modified
      IF OLD.artifact_data IS DISTINCT FROM NEW.artifact_data
        OR OLD.artifact_hash IS DISTINCT FROM NEW.artifact_hash
        OR OLD.artifact_type IS DISTINCT FROM NEW.artifact_type
        OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
        OR OLD.business_id IS DISTINCT FROM NEW.business_id
      THEN
        RAISE EXCEPTION 'Cannot modify immutable artifact fields when setting XML content';
      END IF;
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Compliance artifacts are immutable once created. XML content can only be set once.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_artifact_immutability
  BEFORE UPDATE OR DELETE ON compliance_artifacts
  FOR EACH ROW EXECUTE FUNCTION enforce_artifact_immutability();

-- Phase 1.2: regulator_submissions table
CREATE TABLE IF NOT EXISTS regulator_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  artifact_id UUID NOT NULL REFERENCES compliance_artifacts(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  jurisdiction TEXT NOT NULL,
  regulator_code TEXT NOT NULL,
  submission_status TEXT NOT NULL DEFAULT 'pending',
  submission_reference TEXT NULL,
  submission_response JSONB NULL,
  submitted_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

ALTER TABLE regulator_submissions ENABLE ROW LEVEL SECURITY;

-- Idempotent constraint: one active submission per artifact
CREATE UNIQUE INDEX IF NOT EXISTS idx_regulator_submissions_active_per_artifact
  ON regulator_submissions(artifact_id)
  WHERE submission_status NOT IN ('failed', 'rejected');

-- RLS for regulator_submissions
CREATE POLICY "Business members can view submissions"
  ON regulator_submissions FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage submissions"
  ON regulator_submissions FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Phase 1.3: submission_queue table
CREATE TABLE IF NOT EXISTS submission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES regulator_submissions(id),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE submission_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage queue"
  ON submission_queue FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Phase 1.4: regulatory_events table (append-only)
CREATE TABLE IF NOT EXISTS regulatory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES regulator_submissions(id),
  invoice_id UUID REFERENCES invoices(id),
  business_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE regulatory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view regulatory events"
  ON regulatory_events FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "Platform admins can manage regulatory events"
  ON regulatory_events FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Phase 1.5: Add regulatory_status to invoices (trigger-derived)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS regulatory_status TEXT NOT NULL DEFAULT 'not_required';

-- Validation trigger for allowed values
CREATE OR REPLACE FUNCTION validate_regulatory_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.regulatory_status NOT IN ('not_required', 'pending_submission', 'submitted', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid regulatory_status: %. Allowed values: not_required, pending_submission, submitted, accepted, rejected', NEW.regulatory_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_regulatory_status_trigger
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION validate_regulatory_status();

-- Sync trigger: derive invoice regulatory_status from submissions
CREATE OR REPLACE FUNCTION sync_invoice_regulatory_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE invoices SET regulatory_status = (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM regulator_submissions
                   WHERE invoice_id = NEW.invoice_id AND submission_status = 'accepted') THEN 'accepted'
      WHEN EXISTS (SELECT 1 FROM regulator_submissions
                   WHERE invoice_id = NEW.invoice_id AND submission_status IN ('submitted', 'queued')) THEN 'submitted'
      WHEN EXISTS (SELECT 1 FROM regulator_submissions
                   WHERE invoice_id = NEW.invoice_id AND submission_status IN ('pending', 'retrying')) THEN 'pending_submission'
      WHEN EXISTS (SELECT 1 FROM regulator_submissions
                   WHERE invoice_id = NEW.invoice_id AND submission_status = 'rejected'
                   AND NOT EXISTS (SELECT 1 FROM regulator_submissions
                                   WHERE invoice_id = NEW.invoice_id
                                   AND submission_status NOT IN ('failed', 'rejected'))) THEN 'rejected'
      ELSE 'not_required'
    END
  ) WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_regulatory_status
  AFTER INSERT OR UPDATE ON regulator_submissions
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_regulatory_status();

-- Phase 1.6: State machine function
CREATE OR REPLACE FUNCTION update_submission_status(
  p_submission_id UUID,
  p_new_status TEXT,
  p_response JSONB DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_current_status TEXT;
  v_invoice_id UUID;
  v_business_id UUID;
  v_retry_count INT;
  v_max_retries INT;
BEGIN
  SELECT submission_status, invoice_id, business_id, retry_count, max_retries
    INTO v_current_status, v_invoice_id, v_business_id, v_retry_count, v_max_retries
    FROM regulator_submissions WHERE id = p_submission_id FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Submission not found: %', p_submission_id;
  END IF;

  -- Validate transitions
  IF NOT (
    (v_current_status = 'pending' AND p_new_status = 'queued') OR
    (v_current_status = 'queued' AND p_new_status = 'submitted') OR
    (v_current_status = 'submitted' AND p_new_status IN ('accepted', 'rejected', 'failed')) OR
    (v_current_status = 'failed' AND p_new_status = 'retrying') OR
    (v_current_status = 'retrying' AND p_new_status = 'submitted')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
  END IF;

  -- Check retry limit
  IF p_new_status = 'retrying' AND v_retry_count >= v_max_retries THEN
    RAISE EXCEPTION 'Max retries (%) exceeded for submission %', v_max_retries, p_submission_id;
  END IF;

  -- Update submission
  UPDATE regulator_submissions SET
    submission_status = p_new_status,
    submission_response = COALESCE(p_response, submission_response),
    submission_reference = COALESCE(p_reference, submission_reference),
    submitted_at = CASE WHEN p_new_status = 'submitted' THEN now() ELSE submitted_at END,
    resolved_at = CASE WHEN p_new_status IN ('accepted', 'rejected') THEN now() ELSE resolved_at END,
    retry_count = CASE WHEN p_new_status = 'retrying' THEN retry_count + 1 ELSE retry_count END
  WHERE id = p_submission_id;

  -- Log event
  INSERT INTO regulatory_events (submission_id, invoice_id, business_id, event_type, event_payload)
  VALUES (
    p_submission_id, v_invoice_id, v_business_id,
    'STATUS_CHANGED',
    jsonb_build_object('from', v_current_status, 'to', p_new_status, 'response', p_response, 'reference', p_reference)
  );
END;
$$;

-- Phase 1.7: Extend audit_event_type enum
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'XML_ARTIFACT_GENERATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'REGULATORY_SUBMISSION_CREATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'REGULATORY_STATUS_CHANGED';

-- Phase 1.8: create_regulatory_submission function
CREATE OR REPLACE FUNCTION create_regulatory_submission(
  p_invoice_id UUID,
  p_artifact_id UUID,
  p_business_id UUID,
  p_jurisdiction TEXT,
  p_regulator_code TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_submission_id UUID;
  v_xml_content TEXT;
  v_invoice_status TEXT;
BEGIN
  -- Validate artifact has XML
  SELECT xml_content INTO v_xml_content FROM compliance_artifacts WHERE id = p_artifact_id;
  IF v_xml_content IS NULL THEN
    RAISE EXCEPTION 'Artifact % does not have XML content generated', p_artifact_id;
  END IF;

  -- Validate invoice state
  SELECT status INTO v_invoice_status FROM invoices WHERE id = p_invoice_id;
  IF v_invoice_status IN ('draft', 'voided') THEN
    RAISE EXCEPTION 'Cannot submit invoice in % status', v_invoice_status;
  END IF;

  -- Insert submission (idempotent constraint enforced by unique partial index)
  INSERT INTO regulator_submissions (invoice_id, artifact_id, business_id, jurisdiction, regulator_code, created_by)
  VALUES (p_invoice_id, p_artifact_id, p_business_id, p_jurisdiction, p_regulator_code, p_created_by)
  RETURNING id INTO v_submission_id;

  -- Log creation event
  INSERT INTO regulatory_events (submission_id, invoice_id, business_id, event_type, event_payload)
  VALUES (v_submission_id, p_invoice_id, p_business_id, 'SUBMISSION_CREATED',
    jsonb_build_object('artifact_id', p_artifact_id, 'jurisdiction', p_jurisdiction, 'regulator_code', p_regulator_code));

  -- Create queue entry
  INSERT INTO submission_queue (submission_id) VALUES (v_submission_id);

  RETURN v_submission_id;
END;
$$;
