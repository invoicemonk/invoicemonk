-- Add new audit event types for support ticket notifications
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_CREATED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_REPLY';

-- Create function to get platform admin emails
CREATE OR REPLACE FUNCTION get_platform_admin_emails()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id as user_id, p.email
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'platform_admin'
    AND p.email IS NOT NULL
    AND (p.account_status IS NULL OR p.account_status = 'active');
$$;

-- Create trigger function for ticket creation notifications
CREATE OR REPLACE FUNCTION notify_support_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  _admin RECORD;
BEGIN
  -- Create in-app notification for each platform admin
  FOR _admin IN SELECT user_id FROM get_platform_admin_emails()
  LOOP
    INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
    VALUES (
      _admin.user_id,
      'SUPPORT_TICKET_CREATED',
      'New Support Ticket',
      'A new support ticket has been submitted: ' || NEW.subject,
      'support_ticket',
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for ticket creation
DROP TRIGGER IF EXISTS on_support_ticket_created ON support_tickets;
CREATE TRIGGER on_support_ticket_created
AFTER INSERT ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION notify_support_ticket_created();

-- Create trigger function for admin reply notifications
CREATE OR REPLACE FUNCTION notify_support_ticket_reply()
RETURNS TRIGGER AS $$
DECLARE
  _ticket RECORD;
BEGIN
  -- Only notify user when admin replies (is_admin = true)
  IF NEW.is_admin = true THEN
    SELECT user_id, subject INTO _ticket
    FROM support_tickets
    WHERE id = NEW.ticket_id;
    
    -- Create in-app notification for the ticket owner
    INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
    VALUES (
      _ticket.user_id,
      'SUPPORT_TICKET_REPLY',
      'Support Reply Received',
      'You have a new response on your ticket: ' || _ticket.subject,
      'support_ticket',
      NEW.ticket_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for ticket replies
DROP TRIGGER IF EXISTS on_support_ticket_reply ON support_ticket_messages;
CREATE TRIGGER on_support_ticket_reply
AFTER INSERT ON support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION notify_support_ticket_reply();