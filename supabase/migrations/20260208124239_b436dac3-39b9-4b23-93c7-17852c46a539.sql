-- Drop foreign key constraints on audit_logs to prevent cascade conflicts
-- with the immutability trigger. Audit logs are append-only historical records
-- and should not participate in referential integrity cascades.

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_business_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;