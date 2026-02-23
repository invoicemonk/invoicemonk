
-- Fix search_path on enforce_artifact_immutability
CREATE OR REPLACE FUNCTION enforce_artifact_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Compliance artifacts are immutable and cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.xml_content IS NULL AND NEW.xml_content IS NOT NULL THEN
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

-- Fix search_path on validate_regulatory_status
CREATE OR REPLACE FUNCTION validate_regulatory_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.regulatory_status NOT IN ('not_required', 'pending_submission', 'submitted', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid regulatory_status: %. Allowed values: not_required, pending_submission, submitted, accepted, rejected', NEW.regulatory_status;
  END IF;
  RETURN NEW;
END;
$$;
