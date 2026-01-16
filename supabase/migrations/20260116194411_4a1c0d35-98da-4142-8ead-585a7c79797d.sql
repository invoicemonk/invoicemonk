-- ====================================================================
-- RLS POLICY HARDENING: Add explicit auth.uid() IS NOT NULL checks
-- This adds an additional security layer to explicitly block unauthenticated requests
-- ====================================================================

-- =====================
-- PROFILES TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- =====================
-- USER_ROLES TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- =====================
-- USER_PREFERENCES TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- =====================
-- BUSINESSES TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their businesses" ON public.businesses;
CREATE POLICY "Users can view their businesses" ON public.businesses
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_business_member(auth.uid(), id));

DROP POLICY IF EXISTS "Business admins can update business" ON public.businesses;
CREATE POLICY "Business admins can update business" ON public.businesses
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (public.has_business_role(auth.uid(), id, 'owner') OR public.has_business_role(auth.uid(), id, 'admin')));

DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
CREATE POLICY "Authenticated users can create businesses" ON public.businesses
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- =====================
-- BUSINESS_MEMBERS TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their business memberships" ON public.business_members;
CREATE POLICY "Users can view their business memberships" ON public.business_members
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Business owners can manage members" ON public.business_members;
CREATE POLICY "Business owners can manage members" ON public.business_members
  FOR ALL
  USING (auth.uid() IS NOT NULL AND public.has_business_role(auth.uid(), business_id, 'owner'));

-- =====================
-- CLIENTS TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their clients" ON public.clients;
CREATE POLICY "Users can view their clients" ON public.clients
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can create clients" ON public.clients;
CREATE POLICY "Users can create clients" ON public.clients
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can update their clients" ON public.clients;
CREATE POLICY "Users can update their clients" ON public.clients
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can delete their clients" ON public.clients;
CREATE POLICY "Users can delete their clients" ON public.clients
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.has_business_role(auth.uid(), business_id, 'owner')));

-- =====================
-- INVOICES TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their invoices" ON public.invoices;
CREATE POLICY "Users can view their invoices" ON public.invoices
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can create invoices" ON public.invoices;
CREATE POLICY "Users can create invoices" ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can update their invoices" ON public.invoices;
CREATE POLICY "Users can update their invoices" ON public.invoices
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can delete draft invoices" ON public.invoices;
CREATE POLICY "Users can delete draft invoices" ON public.invoices
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND status = 'draft' AND (auth.uid() = user_id OR public.has_business_role(auth.uid(), business_id, 'owner')));

-- =====================
-- INVOICE_ITEMS TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
CREATE POLICY "Users can view invoice items" ON public.invoice_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id 
    AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
  ));

DROP POLICY IF EXISTS "Users can create invoice items" ON public.invoice_items;
CREATE POLICY "Users can create invoice items" ON public.invoice_items
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id 
    AND i.status = 'draft'
    AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
  ));

DROP POLICY IF EXISTS "Users can update invoice items" ON public.invoice_items;
CREATE POLICY "Users can update invoice items" ON public.invoice_items
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id 
    AND i.status = 'draft'
    AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
  ));

DROP POLICY IF EXISTS "Users can delete invoice items" ON public.invoice_items;
CREATE POLICY "Users can delete invoice items" ON public.invoice_items
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id 
    AND i.status = 'draft'
    AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
  ));

-- =====================
-- PAYMENTS TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view payments for their invoices" ON public.payments;
CREATE POLICY "Users can view payments for their invoices" ON public.payments
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id 
    AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
  ));

DROP POLICY IF EXISTS "Users can record payments for their invoices" ON public.payments;
CREATE POLICY "Users can record payments for their invoices" ON public.payments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id 
    AND i.status != 'draft'
    AND i.status != 'voided'
    AND (i.user_id = auth.uid() OR public.is_business_member(auth.uid(), i.business_id))
  ));

-- =====================
-- CREDIT_NOTES TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their credit notes" ON public.credit_notes;
CREATE POLICY "Users can view their credit notes" ON public.credit_notes
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

DROP POLICY IF EXISTS "Users can create credit notes" ON public.credit_notes;
CREATE POLICY "Users can create credit notes" ON public.credit_notes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

-- =====================
-- NOTIFICATIONS TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications" ON public.notifications
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- =====================
-- SUBSCRIPTIONS TABLE
-- =====================
DROP POLICY IF EXISTS "Users can view their subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their subscriptions" ON public.subscriptions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id)));

-- =====================
-- AUDIT_LOGS TABLE
-- =====================
DROP POLICY IF EXISTS "Users with audit access can view logs" ON public.audit_logs;
CREATE POLICY "Users with audit access can view logs" ON public.audit_logs
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.has_audit_access(auth.uid()) AND (
    actor_id = auth.uid() 
    OR user_id = auth.uid() 
    OR public.is_business_member(auth.uid(), business_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  ));