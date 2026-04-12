
-- Disable protective triggers
ALTER TABLE public.invoice_items DISABLE TRIGGER USER;
ALTER TABLE public.invoices DISABLE TRIGGER USER;
ALTER TABLE public.payments DISABLE TRIGGER USER;
ALTER TABLE public.credit_notes DISABLE TRIGGER USER;
ALTER TABLE public.receipts DISABLE TRIGGER USER;
ALTER TABLE public.compliance_artifacts DISABLE TRIGGER USER;
ALTER TABLE public.audit_logs DISABLE TRIGGER USER;
ALTER TABLE public.businesses DISABLE TRIGGER USER;
ALTER TABLE public.clients DISABLE TRIGGER USER;
ALTER TABLE public.expenses DISABLE TRIGGER USER;
ALTER TABLE public.subscriptions DISABLE TRIGGER USER;
ALTER TABLE public.currency_accounts DISABLE TRIGGER USER;
ALTER TABLE public.payment_methods DISABLE TRIGGER USER;

-- 1. Invoice items first
DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa'));

-- 2. Invoice-dependent records
DELETE FROM public.compliance_artifacts WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.compliance_risks WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.payment_proofs WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.receipts WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa'));
DELETE FROM public.credit_notes WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.online_payments WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.fraud_flags WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');

-- 3. Invoices (before clients!)
DELETE FROM public.invoices WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');

-- 4. Business-related (clients after invoices)
DELETE FROM public.expenses WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.recurring_expenses WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.products_services WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.clients WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.business_members WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.subscriptions WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.notifications WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa') OR user_id IN ('47302849-66d9-4af9-9f67-d7fce42e8eaf','ceaea9d3-9cd7-4ef3-8061-6c77595dd1ef','7ee98f5b-2ee2-48bd-b5ac-f6b218773e9f','6732ff64-7a7d-4298-add4-43e090c6fa40');
DELETE FROM public.payment_methods WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.currency_accounts WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.audit_logs WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa') OR user_id IN ('47302849-66d9-4af9-9f67-d7fce42e8eaf','ceaea9d3-9cd7-4ef3-8061-6c77595dd1ef','7ee98f5b-2ee2-48bd-b5ac-f6b218773e9f','6732ff64-7a7d-4298-add4-43e090c6fa40');
DELETE FROM public.export_manifests WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.business_compliance_analytics WHERE business_id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');
DELETE FROM public.accounting_preferences WHERE user_id IN ('47302849-66d9-4af9-9f67-d7fce42e8eaf','ceaea9d3-9cd7-4ef3-8061-6c77595dd1ef','7ee98f5b-2ee2-48bd-b5ac-f6b218773e9f','6732ff64-7a7d-4298-add4-43e090c6fa40');
DELETE FROM public.lifecycle_events WHERE user_id IN ('47302849-66d9-4af9-9f67-d7fce42e8eaf','ceaea9d3-9cd7-4ef3-8061-6c77595dd1ef','7ee98f5b-2ee2-48bd-b5ac-f6b218773e9f','6732ff64-7a7d-4298-add4-43e090c6fa40');

-- 5. Businesses
DELETE FROM public.businesses WHERE id IN ('be669f32-676f-47bb-b8f1-82e56e87b1dc','ff838aa8-6a0c-491b-8183-700eb08b732a','c4dc7b6e-6979-4da9-8d7a-5066c2c4a799','a9b73df2-7daf-464b-a62c-392807f545aa');

-- 6. Profiles and auth
DELETE FROM public.profiles WHERE id IN ('47302849-66d9-4af9-9f67-d7fce42e8eaf','ceaea9d3-9cd7-4ef3-8061-6c77595dd1ef','7ee98f5b-2ee2-48bd-b5ac-f6b218773e9f','6732ff64-7a7d-4298-add4-43e090c6fa40');
DELETE FROM auth.users WHERE id IN ('47302849-66d9-4af9-9f67-d7fce42e8eaf','ceaea9d3-9cd7-4ef3-8061-6c77595dd1ef','7ee98f5b-2ee2-48bd-b5ac-f6b218773e9f','6732ff64-7a7d-4298-add4-43e090c6fa40');

-- Re-enable all triggers
ALTER TABLE public.invoice_items ENABLE TRIGGER USER;
ALTER TABLE public.invoices ENABLE TRIGGER USER;
ALTER TABLE public.payments ENABLE TRIGGER USER;
ALTER TABLE public.credit_notes ENABLE TRIGGER USER;
ALTER TABLE public.receipts ENABLE TRIGGER USER;
ALTER TABLE public.compliance_artifacts ENABLE TRIGGER USER;
ALTER TABLE public.audit_logs ENABLE TRIGGER USER;
ALTER TABLE public.businesses ENABLE TRIGGER USER;
ALTER TABLE public.clients ENABLE TRIGGER USER;
ALTER TABLE public.expenses ENABLE TRIGGER USER;
ALTER TABLE public.subscriptions ENABLE TRIGGER USER;
ALTER TABLE public.currency_accounts ENABLE TRIGGER USER;
ALTER TABLE public.payment_methods ENABLE TRIGGER USER;
