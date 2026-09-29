/**
 * Product capability registry — the real Invoicemonk product areas and how
 * each journey progresses. Each area is an independent journey; a user can
 * be at different stages in several areas at once.
 *
 * Stages: started → activated → outcome → repeat (continued usage).
 * Activation (first meaningful use) and outcome (value delivered) are distinct.
 * Server-side events are emitted by DB triggers (see lifecycle_events);
 * client-only events go through trackProductEvent().
 */

export type ProductArea =
  | 'invoicing' | 'payments' | 'receipts' | 'credit_notes' | 'clients'
  | 'products_services' | 'expenses' | 'receipt_capture' | 'recurring_expenses'
  | 'vendors' | 'accounting' | 'tax_reports' | 'reports' | 'data_import'
  | 'data_export' | 'team' | 'e_invoicing'
  // Non-journey area for stated-intent prompt interactions; excluded from activation summaries.
  | 'discovery';

export type JourneyStage = 'started' | 'progress' | 'activated' | 'outcome' | 'repeat';

export interface ProductCapability {
  area: ProductArea;
  label: string;
  routes: string[];
  workflows: string[];
  activation: string; // event name
  outcome: string | null; // event name (null = supporting capability)
  source: 'trigger' | 'client' | 'mixed';
}

export const PRODUCT_REGISTRY: ProductCapability[] = [
  { area: 'invoicing', label: 'Invoicing', routes: ['/invoices'], workflows: ['standard_invoice', 'deposit_invoice', 'final_invoice'], activation: 'invoice_issued', outcome: 'invoice_sent', source: 'mixed' },
  { area: 'payments', label: 'Getting paid', routes: ['/receivables'], workflows: ['record_payment', 'invoice_payment'], activation: 'payment_recorded', outcome: 'invoice_paid', source: 'trigger' },
  { area: 'receipts', label: 'Payment receipts', routes: ['/receipts'], workflows: ['payment_receipt'], activation: 'receipt_generated', outcome: 'receipt_delivered', source: 'mixed' },
  { area: 'credit_notes', label: 'Credit notes', routes: ['/credit-notes'], workflows: ['credit_note'], activation: 'credit_note_issued', outcome: null, source: 'trigger' },
  { area: 'clients', label: 'Clients', routes: ['/clients'], workflows: ['client_management'], activation: 'client_created', outcome: null, source: 'trigger' },
  { area: 'products_services', label: 'Products & services', routes: ['/products'], workflows: ['catalog'], activation: 'item_created', outcome: null, source: 'trigger' },
  { area: 'expenses', label: 'Expense tracking', routes: ['/expenses', '/accounting/expenses'], workflows: ['manual_expense', 'expense_with_receipt'], activation: 'expense_recorded', outcome: 'expense_documented', source: 'trigger' },
  { area: 'receipt_capture', label: 'Receipt scanning', routes: ['/expenses/inbox'], workflows: ['expense_inbox', 'scan_receipt', 'scan_invoice'], activation: 'document_scanned', outcome: 'converted_to_expense', source: 'trigger' },
  { area: 'recurring_expenses', label: 'Recurring expenses', routes: ['/expenses'], workflows: ['recurring_expense'], activation: 'recurring_expense_created', outcome: null, source: 'trigger' },
  { area: 'vendors', label: 'Vendors', routes: ['/vendors'], workflows: ['vendor_management'], activation: 'vendor_created', outcome: null, source: 'trigger' },
  { area: 'accounting', label: 'Accounting overview', routes: ['/accounting', '/accounting/income', '/accounting/result', '/accounting/profitability'], workflows: ['overview', 'income', 'result', 'profitability'], activation: 'financial_summary_viewed', outcome: 'profit_result_viewed', source: 'client' },
  { area: 'tax_reports', label: 'Tax reports', routes: ['/accounting/tax-reports'], workflows: ['tax_report'], activation: 'tax_report_viewed', outcome: 'tax_report_exported', source: 'client' },
  { area: 'reports', label: 'Reports', routes: ['/reports', '/analytics'], workflows: ['report_preview', 'report_download', 'report_email'], activation: 'report_previewed', outcome: 'report_delivered', source: 'client' },
  { area: 'data_import', label: 'Import', routes: ['/import'], workflows: ['csv_import', 'migration'], activation: 'import_completed', outcome: null, source: 'client' },
  { area: 'data_export', label: 'Export', routes: ['/settings'], workflows: ['export'], activation: 'export_generated', outcome: 'export_generated', source: 'trigger' },
  { area: 'team', label: 'Team', routes: ['/team'], workflows: ['invite_member'], activation: 'team_member_added', outcome: null, source: 'trigger' },
  { area: 'e_invoicing', label: 'E-invoicing compliance', routes: ['/invoices'], workflows: ['regulator_submission'], activation: 'submission_created', outcome: 'submission_accepted', source: 'trigger' },
];

/** Stated intent options → product areas they map to. */
export const INTENT_OPTIONS: { key: string; label: string; areas: ProductArea[] }[] = [
  { key: 'send_invoices', label: 'Send professional invoices', areas: ['invoicing', 'clients', 'products_services'] },
  { key: 'get_paid', label: 'Get paid & track payments', areas: ['payments', 'receipts'] },
  { key: 'track_expenses', label: 'Track business expenses', areas: ['expenses', 'vendors', 'recurring_expenses'] },
  { key: 'scan_receipts', label: 'Scan & organise receipts', areas: ['receipt_capture'] },
  { key: 'understand_finances', label: 'See profit & finances', areas: ['accounting', 'reports'] },
  { key: 'tax_compliance', label: 'Tax reports & compliance', areas: ['tax_reports', 'e_invoicing'] },
  { key: 'switch_tool', label: 'Move from another tool', areas: ['data_import'] },
  { key: 'other', label: 'Something else', areas: [] },
];

/** Map an in-app path to its client-tracked product area view event. */
export function areaForPath(path: string): { area: ProductArea; workflow: string; event: string; milestone: 'progress' | 'activated' | 'outcome' } | null {
  const p = path.replace(/^\/b\/[^/]+/, '');
  if (p === '/accounting') return { area: 'accounting', workflow: 'overview', event: 'financial_summary_viewed', milestone: 'activated' };
  if (p === '/accounting/income') return { area: 'accounting', workflow: 'income', event: 'income_viewed', milestone: 'progress' };
  if (p === '/accounting/result' || p === '/accounting/profitability') return { area: 'accounting', workflow: p.split('/').pop() ?? 'result', event: 'profit_result_viewed', milestone: 'outcome' };
  if (p === '/accounting/tax-reports') return { area: 'tax_reports', workflow: 'tax_report', event: 'tax_report_viewed', milestone: 'activated' };
  if (p === '/reports' || p === '/analytics') return { area: 'reports', workflow: p.slice(1), event: 'reports_opened', milestone: 'progress' };
  if (p === '/import') return { area: 'data_import', workflow: 'csv_import', event: 'import_opened', milestone: 'progress' };
  return null;
}

/**
 * User jobs beneath each product area. An area is only a container; emails and
 * journeys are reasoned about per job. Mirrors PRODUCT_JOBS in
 * supabase/functions/_shared/product-tip-email.ts (kept in sync by tests).
 */
export const PRODUCT_JOBS: { id: string; area: ProductArea; label: string; workflows: string[] }[] = [
  { id: 'create_and_send_invoice', area: 'invoicing', label: 'Create and send an invoice', workflows: ['standard_invoice', 'deposit_invoice', 'final_invoice'] },
  { id: 'get_invoice_paid', area: 'payments', label: 'Get an invoice paid', workflows: ['invoice_payment'] },
  { id: 'record_payment', area: 'payments', label: 'Record a payment', workflows: ['record_payment'] },
  { id: 'share_payment_receipt', area: 'receipts', label: 'Share a payment receipt', workflows: ['payment_receipt', 'receipt_pdf'] },
  { id: 'issue_credit_note', area: 'credit_notes', label: 'Issue a credit note by voiding an invoice', workflows: ['credit_note'] },
  { id: 'add_client', area: 'clients', label: 'Add a client', workflows: ['client_management'] },
  { id: 'add_catalogue_item', area: 'products_services', label: 'Add a product or service', workflows: ['catalog'] },
  { id: 'add_vendor', area: 'vendors', label: 'Add a vendor', workflows: ['vendor_management'] },
  { id: 'add_team_member', area: 'team', label: 'Add a team member', workflows: ['invite_member'] },
  { id: 'record_expense', area: 'expenses', label: 'Record an expense', workflows: ['manual_expense'] },
  { id: 'record_documented_expense', area: 'expenses', label: 'Record an expense with its receipt', workflows: ['expense_with_receipt'] },
  { id: 'capture_receipt_to_expense', area: 'receipt_capture', label: 'Turn a receipt into an expense', workflows: ['expense_inbox', 'scan_receipt', 'scan_invoice'] },
  { id: 'set_up_recurring_expense', area: 'recurring_expenses', label: 'Set up a recurring expense', workflows: ['recurring_expense'] },
  { id: 'review_overview', area: 'accounting', label: 'Review the account overview', workflows: ['overview'] },
  { id: 'review_income', area: 'accounting', label: 'Review income', workflows: ['income'] },
  { id: 'review_profit', area: 'accounting', label: 'Review profit and result', workflows: ['result', 'profitability'] },
  { id: 'export_tax_report', area: 'tax_reports', label: 'Export a tax report', workflows: ['tax_report'] },
  { id: 'deliver_report', area: 'reports', label: 'Download or email a report', workflows: ['reports', 'analytics', 'report_preview', 'report_download', 'report_email'] },
  { id: 'import_records', area: 'data_import', label: 'Import records', workflows: ['csv_import', 'migration'] },
  { id: 'export_data', area: 'data_export', label: 'Export data', workflows: ['export'] },
  { id: 'submit_to_regulator', area: 'e_invoicing', label: 'Submit an invoice to the tax authority', workflows: ['regulator_submission'] },
];
