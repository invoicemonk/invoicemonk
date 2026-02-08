CREATE OR REPLACE FUNCTION notify_support_ticket_reply()
RETURNS TRIGGER AS $$
DECLARE
  _ticket RECORD;
  _admin_record RECORD;
BEGIN
  SELECT user_id, subject INTO _ticket
  FROM support_tickets
  WHERE id = NEW.ticket_id;
  
  IF NEW.is_admin = true THEN
    -- Admin replied: notify ticket owner
    INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
    VALUES (
      _ticket.user_id,
      'SUPPORT_TICKET_REPLY',
      'Support Reply Received',
      'You have a new response on your ticket: ' || _ticket.subject,
      'support_ticket',
      NEW.ticket_id
    );
  ELSE
    -- User replied: notify all platform admins
    FOR _admin_record IN 
      SELECT user_id FROM get_platform_admin_emails()
    LOOP
      INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
      VALUES (
        _admin_record.user_id,
        'SUPPORT_TICKET_USER_REPLY',
        'User Replied to Ticket',
        'User replied to ticket: ' || _ticket.subject,
        'support_ticket',
        NEW.ticket_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;