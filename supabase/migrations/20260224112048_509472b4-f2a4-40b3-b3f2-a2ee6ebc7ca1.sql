
-- Add reminder tracking columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- Add partial index for efficient cooldown checks on overdue invoices
CREATE INDEX IF NOT EXISTS idx_invoices_reminder_cooldown
  ON public.invoices (business_id, last_reminder_sent_at)
  WHERE status IN ('issued', 'sent');
