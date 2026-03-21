-- Add COMMISSION_VOIDED to the audit_event_type enum
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'COMMISSION_VOIDED';