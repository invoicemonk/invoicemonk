
DO $$
DECLARE
  biz_ids uuid[] := ARRAY[
    '31d4bad2-f79e-4a2a-aa29-276f477e2ff0',
    '3c2db210-9a94-47d6-8e96-82b30780c2da',
    '1344d2d6-c0e0-4813-828d-76b67f96feec',
    '178ca6a0-3af0-4393-8554-8ce15e9fa9f8',
    '005060fb-58d2-4554-8ad5-602b3d4fe282',
    '61d2cbfa-963e-494c-a872-de9b991330ca',
    '1d15c244-f65c-43d3-9f83-ee56bb43b6cb'
  ];
BEGIN
  -- Disable protection triggers
  ALTER TABLE compliance_artifacts DISABLE TRIGGER enforce_artifact_immutability;
  ALTER TABLE payments DISABLE TRIGGER prevent_payments_deletion;
  ALTER TABLE payments DISABLE TRIGGER enforce_payment_retention;
  ALTER TABLE payments DISABLE TRIGGER auto_create_receipt_after_payment;
  ALTER TABLE receipts DISABLE TRIGGER prevent_receipt_modification_trigger;
  ALTER TABLE receipts DISABLE TRIGGER check_receipt_limit_trigger;
  ALTER TABLE receipts DISABLE TRIGGER receipt_inherit_currency_account_trigger;
  ALTER TABLE invoices DISABLE TRIGGER enforce_invoice_deletion_block;
  ALTER TABLE invoices DISABLE TRIGGER enforce_invoice_immutability;
  ALTER TABLE invoices DISABLE TRIGGER enforce_invoice_retention;
  ALTER TABLE invoices DISABLE TRIGGER prevent_invoice_deletion_trigger;
  ALTER TABLE invoices DISABLE TRIGGER prevent_invoice_modification_trigger;
  ALTER TABLE invoices DISABLE TRIGGER reevaluate_currency_lock_on_delete;
  ALTER TABLE invoice_items DISABLE TRIGGER enforce_invoice_item_immutability;
  ALTER TABLE invoice_items DISABLE TRIGGER prevent_invoice_item_modification_trigger;
  ALTER TABLE credit_notes DISABLE TRIGGER prevent_credit_notes_deletion;
  ALTER TABLE credit_notes DISABLE TRIGGER enforce_credit_note_retention;
  ALTER TABLE audit_logs DISABLE TRIGGER enforce_audit_log_immutability;
  ALTER TABLE audit_logs DISABLE TRIGGER prevent_audit_log_modification_trigger;

  -- 1. Compliance & proofs
  DELETE FROM compliance_artifacts WHERE business_id = ANY(biz_ids);
  DELETE FROM compliance_risks WHERE business_id = ANY(biz_ids);
  DELETE FROM regulator_submissions WHERE business_id = ANY(biz_ids);
  DELETE FROM payment_proofs WHERE business_id = ANY(biz_ids);
  DELETE FROM online_payments WHERE business_id = ANY(biz_ids);

  -- 2. Receipts, payments, invoice items
  DELETE FROM receipts WHERE business_id = ANY(biz_ids);
  DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = ANY(biz_ids));
  DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = ANY(biz_ids));

  -- 3. Credit notes, invoices
  DELETE FROM credit_notes WHERE business_id = ANY(biz_ids);
  DELETE FROM invoices WHERE business_id = ANY(biz_ids);

  -- 4. Other tables
  DELETE FROM expenses WHERE business_id = ANY(biz_ids);
  DELETE FROM recurring_expenses WHERE business_id = ANY(biz_ids);
  DELETE FROM clients WHERE business_id = ANY(biz_ids);
  DELETE FROM notifications WHERE business_id = ANY(biz_ids);
  DELETE FROM products_services WHERE business_id = ANY(biz_ids);
  DELETE FROM payment_methods WHERE business_id = ANY(biz_ids);
  DELETE FROM currency_accounts WHERE business_id = ANY(biz_ids);
  DELETE FROM business_compliance_analytics WHERE business_id = ANY(biz_ids);
  DELETE FROM subscriptions WHERE business_id = ANY(biz_ids);
  DELETE FROM business_members WHERE business_id = ANY(biz_ids);
  DELETE FROM audit_logs WHERE business_id = ANY(biz_ids);
  DELETE FROM export_manifests WHERE business_id = ANY(biz_ids);

  -- 5. Delete businesses
  DELETE FROM businesses WHERE id = ANY(biz_ids);

  -- Re-enable triggers
  ALTER TABLE compliance_artifacts ENABLE TRIGGER enforce_artifact_immutability;
  ALTER TABLE payments ENABLE TRIGGER prevent_payments_deletion;
  ALTER TABLE payments ENABLE TRIGGER enforce_payment_retention;
  ALTER TABLE payments ENABLE TRIGGER auto_create_receipt_after_payment;
  ALTER TABLE receipts ENABLE TRIGGER prevent_receipt_modification_trigger;
  ALTER TABLE receipts ENABLE TRIGGER check_receipt_limit_trigger;
  ALTER TABLE receipts ENABLE TRIGGER receipt_inherit_currency_account_trigger;
  ALTER TABLE invoices ENABLE TRIGGER enforce_invoice_deletion_block;
  ALTER TABLE invoices ENABLE TRIGGER enforce_invoice_immutability;
  ALTER TABLE invoices ENABLE TRIGGER enforce_invoice_retention;
  ALTER TABLE invoices ENABLE TRIGGER prevent_invoice_deletion_trigger;
  ALTER TABLE invoices ENABLE TRIGGER prevent_invoice_modification_trigger;
  ALTER TABLE invoices ENABLE TRIGGER reevaluate_currency_lock_on_delete;
  ALTER TABLE invoice_items ENABLE TRIGGER enforce_invoice_item_immutability;
  ALTER TABLE invoice_items ENABLE TRIGGER prevent_invoice_item_modification_trigger;
  ALTER TABLE credit_notes ENABLE TRIGGER prevent_credit_notes_deletion;
  ALTER TABLE credit_notes ENABLE TRIGGER enforce_credit_note_retention;
  ALTER TABLE audit_logs ENABLE TRIGGER enforce_audit_log_immutability;
  ALTER TABLE audit_logs ENABLE TRIGGER prevent_audit_log_modification_trigger;
END $$;
