/*
  PHASE-1 ADMIN NOTIFICATION SYSTEM
  
  This migration creates database triggers to automatically generate notifications
  for platform administrators when key operational events occur.
  
  In Phase-1, admin notifications use a separate namespace of notification types
  prefixed with "ADMIN_" and/or support-specific types. This ensures clear separation
  between user-facing and admin-facing operations.
  
  NOTIFICATION TYPES (Phase-1):
  - ADMIN_USER_REGISTERED: New user signs up
  - ADMIN_EMAIL_VERIFIED: User verifies email
  - ADMIN_SUBSCRIPTION_UPGRADED: Business upgrades plan
  - ADMIN_SUBSCRIPTION_DOWNGRADED: Business downgrades plan
  - ADMIN_PAYMENT_FAILED: Stripe payment fails (handled in edge function)
  - ADMIN_FIRST_INVOICE_ISSUED: Business issues first invoice (handled in edge function)
  - SUPPORT_TICKET_CREATED: User creates support ticket (shared type)
  - SUPPORT_TICKET_USER_REPLY: User replies to ticket (shared type)
  
  SCOPING RULE:
  Admin notifications have business_id = NULL (platform-wide scope).
  User notifications have business_id set to the relevant business.
  This ensures admins ONLY see admin-scoped notifications.
  
  NORMALIZATION PLAN (Phase-2+):
  - Consolidate admin and user notification types into a single extensible enum
  - Add a "scope" or "audience" field to notifications table for flexible permissions
  - Implement notification preferences per user/role
  - Support cross-role notifications (e.g., owner sees payment failures as admin)
  
  For now, the `business_id IS NULL` pattern (admin scope) is a temporary constraint.
  When normalizing, migrate existing records and update RLS policies accordingly.
*/

-- Function: Notify platform admins when a new user registers
CREATE OR REPLACE FUNCTION notify_admin_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  _admin RECORD;
BEGIN
  -- Get all platform admin user IDs and insert notifications
  FOR _admin IN 
    SELECT user_id FROM public.get_platform_admin_emails()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, business_id)
    VALUES (
      _admin.user_id,
      'ADMIN_USER_REGISTERED',
      'New User Registration',
      'A new user has registered: ' || COALESCE(NEW.full_name, NEW.email),
      'user',
      NEW.id,
      NULL  -- Admin-scoped (no business_id)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Fire on new profile creation (happens on signup)
DROP TRIGGER IF EXISTS on_profile_created_notify_admin ON public.profiles;
CREATE TRIGGER on_profile_created_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_user_signup();


-- Function: Notify platform admins when a user verifies their email
CREATE OR REPLACE FUNCTION notify_admin_email_verified()
RETURNS TRIGGER AS $$
DECLARE
  _admin RECORD;
BEGIN
  -- Only notify if email_verified changed from false/null to true
  IF (OLD.email_verified IS DISTINCT FROM NEW.email_verified) AND NEW.email_verified = true THEN
    FOR _admin IN 
      SELECT user_id FROM public.get_platform_admin_emails()
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, business_id)
      VALUES (
        _admin.user_id,
        'ADMIN_EMAIL_VERIFIED',
        'Email Verified',
        'User verified their email: ' || NEW.email,
        'user',
        NEW.id,
        NULL  -- Admin-scoped
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Fire on profile email verification
DROP TRIGGER IF EXISTS on_profile_email_verified_notify_admin ON public.profiles;
CREATE TRIGGER on_profile_email_verified_notify_admin
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_email_verified();


-- Function: Notify platform admins on subscription tier changes
CREATE OR REPLACE FUNCTION notify_admin_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
  _admin RECORD;
  _business_name TEXT;
  _notification_type TEXT;
  _title TEXT;
  _message TEXT;
BEGIN
  -- Only notify on tier changes
  IF OLD.tier IS DISTINCT FROM NEW.tier THEN
    -- Get business name
    SELECT name INTO _business_name 
    FROM public.businesses 
    WHERE id = NEW.business_id;
    
    -- Determine upgrade vs downgrade based on tier hierarchy
    -- Hierarchy: starter < starter_paid < professional < business
    IF (
      (OLD.tier = 'starter' AND NEW.tier IN ('starter_paid', 'professional', 'business')) OR
      (OLD.tier = 'starter_paid' AND NEW.tier IN ('professional', 'business')) OR
      (OLD.tier = 'professional' AND NEW.tier = 'business')
    ) THEN
      _notification_type := 'ADMIN_SUBSCRIPTION_UPGRADED';
      _title := 'Subscription Upgraded';
      _message := COALESCE(_business_name, 'A business') || ' upgraded to ' || NEW.tier;
    ELSE
      _notification_type := 'ADMIN_SUBSCRIPTION_DOWNGRADED';
      _title := 'Subscription Downgraded';
      _message := COALESCE(_business_name, 'A business') || ' downgraded to ' || NEW.tier;
    END IF;
    
    FOR _admin IN 
      SELECT user_id FROM public.get_platform_admin_emails()
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, business_id)
      VALUES (
        _admin.user_id,
        _notification_type,
        _title,
        _message,
        'subscription',
        NEW.id,
        NULL  -- Admin-scoped
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Fire on subscription tier changes
DROP TRIGGER IF EXISTS on_subscription_changed_notify_admin ON public.subscriptions;
CREATE TRIGGER on_subscription_changed_notify_admin
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_subscription_change();


-- Function: Create admin notification for first invoice issued
-- This is called from the issue-invoice edge function
CREATE OR REPLACE FUNCTION notify_admin_first_invoice_issued(
  _business_id UUID,
  _invoice_id UUID,
  _invoice_number TEXT
)
RETURNS VOID AS $$
DECLARE
  _admin RECORD;
  _business_name TEXT;
BEGIN
  -- Get business name
  SELECT name INTO _business_name 
  FROM public.businesses 
  WHERE id = _business_id;
  
  FOR _admin IN 
    SELECT user_id FROM public.get_platform_admin_emails()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, business_id)
    VALUES (
      _admin.user_id,
      'ADMIN_FIRST_INVOICE_ISSUED',
      'First Invoice Milestone',
      COALESCE(_business_name, 'A business') || ' issued their first invoice: ' || _invoice_number,
      'invoice',
      _invoice_id,
      NULL  -- Admin-scoped
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Function: Create admin notification for payment failures
-- This is called from the stripe-webhook edge function
CREATE OR REPLACE FUNCTION notify_admin_payment_failed(
  _subscription_id UUID,
  _business_name TEXT
)
RETURNS VOID AS $$
DECLARE
  _admin RECORD;
BEGIN
  FOR _admin IN 
    SELECT user_id FROM public.get_platform_admin_emails()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, business_id)
    VALUES (
      _admin.user_id,
      'ADMIN_PAYMENT_FAILED',
      'Payment Failed',
      'Payment failed for ' || COALESCE(_business_name, 'a business'),
      'subscription',
      _subscription_id,
      NULL  -- Admin-scoped
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;