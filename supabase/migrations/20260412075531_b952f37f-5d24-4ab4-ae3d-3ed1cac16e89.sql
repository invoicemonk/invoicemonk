
DO $$
DECLARE
  _user_id  uuid := '59357cd9-1025-47d7-9130-41e5ce0c7983';
  _biz_id   uuid := '2a7f598d-60db-4c70-a8c6-0590c3008b76';
BEGIN
  -- Invoice child tables
  DELETE FROM public.compliance_artifacts WHERE business_id = _biz_id;
  DELETE FROM public.compliance_risks WHERE business_id = _biz_id OR user_id = _user_id;
  DELETE FROM public.fraud_flags WHERE business_id = _biz_id;
  DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE business_id = _biz_id);
  DELETE FROM public.payment_proofs WHERE business_id = _biz_id;
  DELETE FROM public.receipts WHERE business_id = _biz_id;
  DELETE FROM public.payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE business_id = _biz_id);
  DELETE FROM public.credit_notes WHERE business_id = _biz_id;
  DELETE FROM public.online_payments WHERE business_id = _biz_id;
  DELETE FROM public.invoices WHERE business_id = _biz_id;

  -- Other business data
  DELETE FROM public.recurring_expenses WHERE business_id = _biz_id OR user_id = _user_id;
  DELETE FROM public.expenses WHERE business_id = _biz_id OR user_id = _user_id;
  DELETE FROM public.products_services WHERE business_id = _biz_id;
  DELETE FROM public.clients WHERE business_id = _biz_id;
  DELETE FROM public.payment_methods WHERE business_id = _biz_id;
  DELETE FROM public.currency_accounts WHERE business_id = _biz_id;
  DELETE FROM public.export_manifests WHERE business_id = _biz_id OR actor_id = _user_id;
  DELETE FROM public.audit_logs WHERE business_id = _biz_id OR user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.lifecycle_events WHERE user_id = _user_id;
  DELETE FROM public.accounting_preferences WHERE user_id = _user_id;
  DELETE FROM public.subscriptions WHERE business_id = _biz_id;
  DELETE FROM public.business_compliance_analytics WHERE business_id = _biz_id;
  DELETE FROM public.business_members WHERE business_id = _biz_id;
  DELETE FROM public.businesses WHERE id = _biz_id;

  -- Partner data (if any)
  DELETE FROM public.partner_applications WHERE user_id = _user_id;

  -- User identity
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
