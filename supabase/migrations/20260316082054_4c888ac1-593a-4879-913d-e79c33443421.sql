
-- Add new enum values for ban/unban audit events
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'USER_SUSPENDED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'USER_REACTIVATED';
