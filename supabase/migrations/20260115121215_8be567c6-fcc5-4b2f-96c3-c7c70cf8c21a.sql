-- =============================================
-- CRITICAL COMPLIANCE FIX: Attach All Database Triggers
-- =============================================
-- Drop existing triggers if any (cleanup from potential partial runs)
-- Then create all required triggers

-- Drop any existing triggers to ensure clean slate
DROP TRIGGER IF EXISTS enforce_invoice_immutability ON invoices;
DROP TRIGGER IF EXISTS enforce_invoice_deletion_block ON invoices;
DROP TRIGGER IF EXISTS enforce_currency_lock_on_issuance ON invoices;
DROP TRIGGER IF EXISTS enforce_currency_immutability ON invoices;
DROP TRIGGER IF EXISTS enforce_audit_log_immutability ON audit_logs;
DROP TRIGGER IF EXISTS enforce_invoice_item_immutability ON invoice_items;
DROP TRIGGER IF EXISTS enforce_invoice_retention ON invoices;
DROP TRIGGER IF EXISTS enforce_payment_retention ON payments;
DROP TRIGGER IF EXISTS enforce_credit_note_retention ON credit_notes;
DROP TRIGGER IF EXISTS enforce_team_member_limit ON business_members;
DROP TRIGGER IF EXISTS compute_business_compliance_trigger ON businesses;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS add_business_owner ON businesses;

-- 1. INVOICE IMMUTABILITY - Prevent modification of issued invoices
CREATE TRIGGER enforce_invoice_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_modification();

-- 2. INVOICE DELETION BLOCK - Only allow draft invoice deletion
CREATE TRIGGER enforce_invoice_deletion_block
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_deletion();

-- 3. CURRENCY LOCKING ON ISSUANCE - Lock currency when invoice is issued
CREATE TRIGGER enforce_currency_lock_on_issuance
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION lock_business_currency();

-- 4. CURRENCY IMMUTABILITY - Prevent currency changes on issued invoices
CREATE TRIGGER enforce_currency_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_currency_change();

-- 5. AUDIT LOG IMMUTABILITY - Prevent modification/deletion of audit logs
CREATE TRIGGER enforce_audit_log_immutability
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- 6. INVOICE ITEM IMMUTABILITY - Prevent modification of items on issued invoices
CREATE TRIGGER enforce_invoice_item_immutability
  BEFORE UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_item_modification();

-- 7. FINANCIAL RECORD RETENTION - Prevent deletion of issued invoices
CREATE TRIGGER enforce_invoice_retention
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_record_deletion();

-- 8. PAYMENT RETENTION - Prevent deletion of payment records
CREATE TRIGGER enforce_payment_retention
  BEFORE DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_record_deletion();

-- 9. CREDIT NOTE RETENTION - Prevent deletion of credit notes
CREATE TRIGGER enforce_credit_note_retention
  BEFORE DELETE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_record_deletion();

-- 10. TEAM MEMBER LIMIT ENFORCEMENT - Check tier limits on team additions
CREATE TRIGGER enforce_team_member_limit
  BEFORE INSERT ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_member_limit();

-- 11. BUSINESS COMPLIANCE AUTO-COMPUTE - Auto-calculate compliance status
CREATE TRIGGER compute_business_compliance_trigger
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION compute_business_compliance();

-- 12. UPDATED_AT TRIGGERS - Ensure updated_at columns are maintained
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 13. ADD BUSINESS CREATOR AS OWNER
CREATE TRIGGER add_business_owner
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION add_business_creator_as_owner();