-- Add enhanced reminder settings columns to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS reminder_schedule jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS overdue_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS overdue_reminder_schedule jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reminder_email_template text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.reminder_schedule IS 'Array of days before due date to send reminders (e.g., [7, 3, 1])';
COMMENT ON COLUMN public.user_preferences.overdue_reminder_enabled IS 'Enable follow-up reminders after due date';
COMMENT ON COLUMN public.user_preferences.overdue_reminder_schedule IS 'Array of days after due date to send reminders (e.g., [1, 7, 14, 30])';
COMMENT ON COLUMN public.user_preferences.reminder_email_template IS 'Custom message to include in reminder emails';