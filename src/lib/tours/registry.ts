/**
 * Registry of all in-app guided tours.
 *
 * Steps target elements via CSS selectors — prefer stable `data-tour="..."`
 * attributes, falling back to structural selectors. Steps whose element is
 * absent are skipped automatically by the tour engine, so it's safe to list
 * optional cards / plan-gated features.
 *
 * Two extras make tours more than a slideshow:
 *  - `beforeStep()` runs before the step is shown (e.g. switch a settings tab
 *    or open a dialog). The engine then waits for the step's element.
 *  - `advanceOn` turns a step interactive: the tour waits for the user to
 *    click / fill / see something before moving on. A "Skip step" button is
 *    always available so nobody gets stuck.
 */

export interface TourStepAdvance {
  /**
   * click  — user clicks the target
   * input  — user types a non-empty value into the target
   * appear — the target shows up on screen (e.g. a dialog opened)
   */
  type: 'click' | 'input' | 'appear';
  /** Defaults to the step's own `element`. */
  selector?: string;
}

export interface TourStep {
  /** CSS selector for the element to highlight. Omit for a centered step. */
  element?: string;
  title: string;
  description: string;
  /** Runs before the step is shown — switch a tab, open a panel, etc. */
  beforeStep?: () => void | Promise<void>;
  /** Wait for a real user action instead of a Next click. */
  advanceOn?: TourStepAdvance;
}

export interface TourDefinition {
  id: string;
  label: string;
  description: string;
  /** Grouping label for the help menu. */
  group?: string;
  /** Path suffix used to match the current route, e.g. '/invoices'. */
  match?: string;
  /** Relative path (appended to /b/:businessId) to navigate to first. */
  path?: string;
  steps: TourStep[];
}

export const WELCOME_TOUR_ID = 'welcome';

/** Click an element if it exists — used by `beforeStep` hooks below. */
function click(selector: string) {
  document.querySelector<HTMLElement>(selector)?.click();
}

export const TOURS: TourDefinition[] = [
  {
    id: WELCOME_TOUR_ID,
    label: 'Welcome tour',
    description: 'A quick lap around Invoicemonk — start here',
    group: 'Getting started',
    path: '/dashboard',
    match: '/dashboard',
    steps: [
      {
        title: 'Welcome to Invoicemonk',
        description:
          'This short tour shows you where everything lives. You can stop any time and replay it later from the help menu.',
      },
      {
        element: '[data-tour="business-switcher"]',
        title: 'Your business',
        description:
          'Every invoice, client and report belongs to a business. Switch between businesses — or add another — right here.',
      },
      {
        element: '[data-tour="currency-switcher"]',
        title: 'Currency accounts',
        description:
          'Each currency you invoice in gets its own account, with its own payment methods, products and numbering.',
      },
      {
        element: '[data-tour="nav-invoices"]',
        title: 'Invoices',
        description:
          'Create, issue and track invoices. Once issued, an invoice is locked and tamper-evident — corrections happen through credit notes.',
      },
      {
        element: '[data-tour="nav-clients"]',
        title: 'Clients',
        description:
          'Store the legal name, address and tax ID of the people you bill. These details are required on compliant invoices.',
      },
      {
        element: '[data-tour="nav-accounting"]',
        title: 'Accounting & reports',
        description:
          'Expenses, vendors, receivables and financial reports live in this group — everything your accountant asks for.',
      },
      {
        element: '[data-tour="quick-setup"]',
        title: 'Your setup checklist',
        description:
          'Work through these steps and your first invoice will meet the legal requirements for your country.',
      },
      {
        element: '[data-tour="nav-settings"]',
        title: 'Business settings',
        description:
          'Your address, tax ID, logo, payment methods and invoice template are configured here.',
      },
      {
        element: '[data-tour="help-menu"]',
        title: 'Need this again?',
        description:
          'Open this help menu any time to replay this tour or start a tour of the page you are on.',
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Read your numbers at a glance',
    group: 'Getting started',
    path: '/dashboard',
    match: '/dashboard',
    steps: [
      {
        element: '[data-tour="dashboard-stats"]',
        title: 'Key figures',
        description:
          'Revenue, outstanding amounts, overdue invoices and paid totals for the period you select. Outstanding counts issued invoices that have not been paid in full yet.',
      },
      {
        element: '[data-tour="dashboard-range"]',
        title: 'Change the period',
        description:
          'Switch the date range to compare months, quarters or a custom window. Every figure and chart on this page follows the range you pick.',
      },
      {
        element: '[data-tour="quick-setup"]',
        title: 'Setup checklist',
        description:
          'Any compliance gaps in your profile show up here until they are resolved — missing tax ID, address, logo or payment details.',
      },
      {
        element: '[data-tour="dashboard-recent"]',
        title: 'Recent activity',
        description: 'Your latest invoices, with status badges — click through to open any of them.',
      },
      {
        element: '[data-tour="notifications"]',
        title: 'Notifications',
        description: 'Payments received, invoices viewed and compliance alerts land here.',
      },
      {
        element: '[data-tour="currency-switcher"]',
        title: 'One account at a time',
        description:
          'The dashboard reports on the active currency account. Switch accounts here to see the same figures for another currency.',
      },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    description: 'Create, issue and track invoices',
    group: 'Sales',
    path: '/invoices',
    match: '/invoices',
    steps: [
      {
        element: '[data-tour="invoice-table"]',
        title: 'Your invoice list',
        description:
          'Every invoice for the active business and currency account, newest first, with client, date, amount and status.',
      },
      {
        element: '[data-tour="invoice-new"]',
        title: 'Create an invoice',
        description:
          'Start a draft here. Drafts can be edited freely; issuing locks the invoice and assigns its legal number.',
      },
      {
        element: '[data-tour="invoice-search"]',
        title: 'Search',
        description: 'Search by invoice number, client name or amount.',
      },
      {
        element: '[data-tour="invoice-filter-button"]',
        title: 'Filters',
        description:
          'Narrow the list by status, client or date range — including a custom period. Active filters show a count, and can be cleared in one click.',
      },
      {
        element: '[data-tour="invoice-table"]',
        title: 'Statuses explained',
        description:
          'Draft, issued, sent, viewed, paid, voided or credited — the badge tells you exactly where an invoice stands. Overdue is derived from the due date.',
      },
      {
        element: '[data-tour="invoice-table"]',
        title: 'Row actions',
        description:
          'Open the menu on any row to view, download the PDF, send it to the client, record a payment, duplicate it or raise a credit note.',
      },
      {
        element: '[data-tour="invoice-export"]',
        title: 'Export',
        description:
          'Export the filtered list for your accountant or bookkeeping software.',
      },
      {
        element: '[data-tour="invoice-credit-notes-tab"]',
        title: 'Credit notes',
        description:
          'Issued invoices cannot be edited or deleted. Correct or cancel one with a credit note — they all live under this tab, linked to the original invoice.',
      },
      {
        element: '[data-tour="currency-switcher"]',
        title: 'Numbering per account',
        description:
          'Invoice numbers are sequential and gapless within each currency account, which is what auditors expect.',
      },
    ],
  },
  {
    id: 'invoice-new',
    label: 'Create an invoice (interactive)',
    description: 'Build a real invoice step by step',
    group: 'Sales',
    path: '/invoices/new',
    match: '/invoices/new',
    steps: [
      {
        title: 'Let’s build an invoice',
        description:
          'This one is hands-on: do each step in the form and the tour follows along. You can skip any step.',
      },
      {
        element: '[data-tour="invoice-form-client"]',
        title: 'Pick the client',
        description:
          'Choose an existing client or create one inline. Their legal name, address and tax ID print on the invoice.',
        advanceOn: { type: 'click' },
      },
      {
        element: '[data-tour="invoice-form-dates"]',
        title: 'Dates and terms',
        description:
          'The issue date fixes the invoice in your books; the due date drives reminders and overdue reporting.',
      },
      {
        element: '[data-tour="invoice-form-items"]',
        title: 'Add a line item',
        description:
          'Describe what you sold with quantity, unit price and tax rate. Saved products and services autofill here.',
        advanceOn: { type: 'click' },
      },
      {
        element: '[data-tour="invoice-form-totals"]',
        title: 'Totals and tax',
        description:
          'Subtotal, tax and total are calculated for you using your jurisdiction rules — discounts and withholding included where they apply.',
      },
      {
        element: '[data-tour="invoice-form-actions"]',
        title: 'Save or issue',
        description:
          'Save as a draft to keep editing, or issue it to lock the invoice, assign its legal number and generate its verification page and QR code.',
      },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Manage who you bill',
    group: 'Sales',
    path: '/clients',
    match: '/clients',
    steps: [
      {
        element: '[data-tour="client-list"]',
        title: 'Your client book',
        description:
          'Every client you bill, with their outstanding balance at a glance. Click a card to open the full record.',
      },
      {
        element: '[data-tour="client-search"]',
        title: 'Find a client',
        description: 'Search by name, email or tax ID.',
      },
      {
        element: '[data-tour="client-row-actions"]',
        title: 'Per-client actions',
        description:
          'Edit details, invoice this client, send a statement or archive them when you stop working together.',
      },
      {
        element: '[data-tour="client-new"]',
        title: 'Add a client',
        description:
          'Let’s add one now — click "Add Client" to open the form.',
        advanceOn: { type: 'click' },
      },
      {
        element: '[data-tour="client-form-name"]',
        title: 'Legal name',
        description:
          'Use the client’s registered legal name, not a nickname — this is what must appear on a compliant invoice.',
        advanceOn: { type: 'input' },
      },
      {
        element: '[data-tour="client-form-country"]',
        title: 'Country',
        description:
          'The country decides which fields are required and how tax is applied — cross-border rules kick in automatically.',
      },
      {
        element: '[data-tour="client-form-tax"]',
        title: 'Tax ID',
        description:
          'For B2B clients the tax ID (VAT/TIN) is usually mandatory and is validated against the country format.',
      },
      {
        element: '[data-tour="client-form-address"]',
        title: 'Billing address',
        description:
          'A full billing address is legally required in most jurisdictions. Expand this section to fill it in.',
      },
      {
        element: '[data-tour="client-form-save"]',
        title: 'Save the client',
        description:
          'Save and they are immediately selectable on any new invoice. You can close the dialog if you were only looking.',
      },
    ],
  },
  {
    id: 'products',
    label: 'Products & services',
    description: 'Reusable line items',
    group: 'Sales',
    path: '/products',
    match: '/products',
    steps: [
      {
        element: '[data-tour="product-table"]',
        title: 'Your catalogue',
        description:
          'Everything you sell, with default price, tax rate, SKU and stock. Items are scoped to the active currency account.',
      },
      {
        element: '[data-tour="product-new"]',
        title: 'Add an item',
        description:
          'Store name, unit price and tax rate once, then add it to any invoice in a couple of clicks.',
      },
      {
        element: '[data-tour="product-search"]',
        title: 'Search',
        description: 'Search by name, SKU or category.',
      },
      {
        element: '[data-tour="product-filters"]',
        title: 'Filter the catalogue',
        description:
          'Split products from services, or bring archived items back into view.',
      },
      {
        element: '[data-tour="product-table"]',
        title: 'Edit and archive',
        description:
          'Use the row menu to edit or archive an item. Archiving keeps it on past invoices but hides it from new ones.',
      },
      {
        title: 'On the invoice',
        description:
          'When you add a line item on an invoice, start typing and your catalogue autocompletes the description, price and tax.',
      },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    description: 'Track what you spend',
    group: 'Purchases',
    path: '/expenses',
    match: '/expenses',
    steps: [
      {
        element: '[data-tour="expense-summary"]',
        title: 'What you have spent',
        description:
          'Totals for the selected period, split by category — the same figures feed your profit and tax reports.',
      },
      {
        element: '[data-tour="expense-table"]',
        title: 'Expense records',
        description:
          'Each expense carries the amount, tax, vendor, category, date and its attached receipt.',
      },
      {
        element: '[data-tour="expense-new"]',
        title: 'Record an expense',
        description: 'Let’s add one — open the expense form.',
        advanceOn: { type: 'click' },
      },
      {
        element: '[data-tour="expense-form-amount"]',
        title: 'Amount and tax',
        description:
          'Enter the gross amount; deductible tax is separated out so it lands correctly in your tax report.',
        advanceOn: { type: 'input' },
      },
      {
        element: '[data-tour="expense-form-vendor"]',
        title: 'Vendor',
        description:
          'Link the supplier so spend per vendor rolls up automatically. New vendors can be created inline.',
      },
      {
        element: '[data-tour="expense-form-category"]',
        title: 'Category',
        description:
          'The category maps the expense to the right account in your books — pick the closest match.',
      },
      {
        element: '[data-tour="expense-form-receipt"]',
        title: 'Attach the receipt',
        description:
          'Most tax authorities require proof of purchase. Attach the receipt now and it stays with the record.',
      },
      {
        element: '[data-tour="expense-form-save"]',
        title: 'Save',
        description: 'Saving posts the expense to your books for the selected date.',
      },
      {
        element: '[data-tour="expense-filters"]',
        title: 'Filters',
        description: 'Narrow by period, category, vendor or payment status.',
      },
      {
        title: 'Recurring expenses',
        description:
          'Rent, subscriptions and other fixed costs can be set up once and generated on a schedule.',
      },
      {
        element: '[data-tour="nav-expense-inbox"]',
        title: 'Expense inbox',
        description:
          'Forward or upload receipts and let scanning read the amounts, then approve them into your books.',
      },
      {
        element: '[data-tour="nav-vendors"]',
        title: 'Vendors',
        description: 'Suppliers are kept here so spend per vendor rolls up automatically.',
      },
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    description: 'Suppliers you buy from',
    group: 'Purchases',
    path: '/vendors',
    match: '/vendors',
    steps: [
      {
        element: '[data-tour="vendor-table"]',
        title: 'Your suppliers',
        description:
          'Every vendor you record expenses against, with total spend so you can see where the money goes.',
      },
      {
        element: '[data-tour="vendor-new"]',
        title: 'Add a vendor',
        description:
          'Name, contact details and tax ID. Supplier tax IDs matter when you reclaim input tax.',
      },
      {
        element: '[data-tour="vendor-search"]',
        title: 'Find a vendor',
        description: 'Search by name or tax ID.',
      },
      {
        title: 'Linking expenses',
        description:
          'Pick a vendor when you record an expense — the vendor page then shows every purchase from them.',
      },
    ],
  },
  {
    id: 'expense-inbox',
    label: 'Expense inbox',
    description: 'Receipts in, expenses out',
    group: 'Purchases',
    path: '/expenses/inbox',
    match: '/expenses/inbox',
    steps: [
      {
        element: '[data-tour="inbox-upload"]',
        title: 'Send receipts in',
        description:
          'Upload a photo or PDF of any receipt. Scanning reads the vendor, date, amount and tax for you.',
      },
      {
        title: 'Forward by email',
        description:
          'Forward supplier receipts to this address and they arrive here automatically — no manual upload.',
      },
      {
        element: '[data-tour="inbox-list"]',
        title: 'Waiting for review',
        description:
          'Scanned items sit here until you check them. Nothing hits your books before you approve it.',
      },
      {
        element: '[data-tour="inbox-review"]',
        title: 'Review and approve',
        description:
          'Correct anything the scan misread, pick a category, then approve to create the expense with the receipt attached.',
      },
      {
        title: 'Duplicates',
        description:
          'Receipts that look like ones you already have get flagged, so a forwarded copy does not double-count.',
      },
    ],
  },
  {
    id: 'receipts',
    label: 'Receipts',
    description: 'Proof of payment for your clients',
    group: 'Sales',
    path: '/receipts',
    match: '/receipts',
    steps: [
      {
        title: 'What a receipt is here',
        description:
          'A receipt is proof that a client paid. One is created automatically whenever you record a payment against an invoice.',
      },
      {
        element: '[data-tour="receipt-pending"]',
        title: 'Payments awaiting a receipt',
        description:
          'Recorded payments that have no receipt yet appear here — issue one in a click.',
      },
      {
        element: '[data-tour="receipt-table"]',
        title: 'Issued receipts',
        description:
          'Receipt number, payer, the invoice it settles, amount and date. Numbers are sequential, like invoices.',
      },
      {
        element: '[data-tour="receipt-row-actions"]',
        title: 'Send or download',
        description:
          'Email the receipt to the client, download the PDF, or open it to see the full document.',
      },
      {
        element: '[data-tour="receipt-search"]',
        title: 'Find a receipt',
        description: 'Search by receipt number, client or invoice number.',
      },
      {
        title: 'Partial payments',
        description:
          'Pay in instalments and each payment gets its own receipt, all linked back to the same invoice.',
      },
    ],
  },
  {
    id: 'receivables',
    label: 'Receivables',
    description: 'Chase what you are owed',
    group: 'Sales',
    path: '/receivables',
    match: '/receivables',
    steps: [
      {
        element: '[data-tour="receivables-summary"]',
        title: 'Aging at a glance',
        description:
          'Outstanding balances bucketed by how overdue they are — current, 30, 60, 90+ days.',
      },
      {
        element: '[data-tour="receivables-table"]',
        title: 'Open invoices',
        description: 'Every unpaid invoice with its client, due date and days overdue.',
      },
      {
        title: 'Reminders',
        description:
          'Send a polite nudge — or set reminders to go out automatically before and after the due date.',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Tax and revenue reporting',
    group: 'Accounting',
    path: '/reports',
    match: '/reports',
    steps: [
      {
        element: '[data-tour="reports-tabs"]',
        title: 'Report types',
        description: 'Revenue, tax summaries and client breakdowns for any period.',
      },
      {
        element: '[data-tour="reports-range"]',
        title: 'Pick the period',
        description:
          'Month, quarter, year or a custom range — match it to your filing period.',
      },
      {
        element: '[data-tour="reports-export"]',
        title: 'Export and share',
        description: 'Download as CSV or PDF, or email a report straight to your accountant.',
      },
      {
        title: 'What is included',
        description:
          'Reports count issued invoices and recorded expenses for the active currency account. Drafts are never included.',
      },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Books, ledger and statements',
    group: 'Accounting',
    path: '/accounting',
    match: '/accounting',
    steps: [
      {
        title: 'Your books',
        description:
          'Invoices, payments and expenses post here automatically — no double entry by hand.',
      },
      {
        element: '[data-tour="nav-accounting"]',
        title: 'Sections',
        description:
          'Income, expenses, result, profitability and tax reports each have their own view in this group.',
      },
      {
        title: 'Statements',
        description: 'Chart of accounts, ledger and financial statements for the selected period.',
      },
      {
        title: 'Closing a period',
        description:
          'Once a period is filed, the underlying documents stay locked and tamper-evident — corrections go through credit notes.',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Business settings',
    description: 'Profile, tax ID, logo, payments, team',
    group: 'Setup',
    path: '/settings',
    match: '/settings',
    steps: [
      {
        element: '[data-tour="settings-profile"]',
        title: 'Business settings',
        description:
          'This tour walks every section, switching tabs as it goes. Everything here prints on your invoices or governs how they are numbered.',
        beforeStep: () => click('[data-tour="settings-tab-profile"]'),
      },
      {
        element: '[data-tour="settings-completion"]',
        title: 'Compliance progress',
        description:
          'Anything still missing for a legally valid invoice is listed here, with a progress bar.',
      },
      {
        element: '[data-tour="settings-identity"]',
        title: 'Legal identity',
        description:
          'Registered business name, legal form, registration number and logo. This is the name that must appear on every invoice.',
      },
      {
        element: '[data-tour="settings-address"]',
        title: 'Registered address',
        description:
          'Your legal address and contact details, printed in the invoice header.',
      },
      {
        title: 'Tax configuration',
        description:
          'Tax ID, tax scheme and default rates for your jurisdiction — these drive how tax is calculated and shown.',
      },
      {
        element: '[data-tour="settings-invoicing"]',
        title: 'Invoicing defaults',
        description:
          'Default currency, payment terms, notes and numbering. Numbering stays sequential per currency account.',
      },
      {
        element: '[data-tour="settings-verification"]',
        title: 'Verification documents',
        description:
          'Upload registration or ID documents to get verified — verified businesses show a trust badge on their invoices.',
      },
      {
        element: '[data-tour="settings-payments"]',
        title: 'Payment methods',
        description:
          'Bank details, mobile money or online payment links shown to clients on their invoices.',
      },
      {
        element: '[data-tour="settings-save"]',
        title: 'Save your changes',
        description:
          'Changes on this tab are not applied until you save. The tour will not save anything for you.',
      },
      {
        element: '[data-tour="settings-tab-team"]',
        title: 'Team access',
        description:
          'Invite colleagues and give them owner, admin, member or auditor access.',
        beforeStep: () => click('[data-tour="settings-tab-team"]'),
      },
      {
        element: '[data-tour="settings-tab-billing"]',
        title: 'Plan & billing',
        description:
          'Your subscription, what your plan unlocks, and receipts for payments to us.',
        beforeStep: () => click('[data-tour="settings-tab-billing"]'),
      },
      {
        element: '[data-tour="settings-tab-audit"]',
        title: 'Audit logs',
        description:
          'Who changed what and when. Useful for accountants and required in several jurisdictions.',
        beforeStep: () => click('[data-tour="settings-tab-audit"]'),
      },
      {
        element: '[data-tour="settings-danger"]',
        title: 'Danger zone',
        description:
          'Deleting or deactivating a business is permanent and keeps its documents locked for the retention period.',
        beforeStep: () => click('[data-tour="settings-tab-profile"]'),
      },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Invite colleagues and set roles',
    group: 'Setup',
    path: '/team',
    match: '/team',
    steps: [
      {
        element: '[data-tour="team-invite"]',
        title: 'Invite someone',
        description: 'Send an email invitation — they join this business once they accept.',
      },
      {
        element: '[data-tour="team-list"]',
        title: 'Who has access',
        description: 'Everyone with access to this business, plus pending invitations.',
      },
      {
        element: '[data-tour="team-roles"]',
        title: 'Roles',
        description:
          'Owner controls billing and deletion, admin manages settings, member creates documents, auditor gets read-only access.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Plan & billing',
    description: 'Your subscription and invoices from us',
    group: 'Setup',
    path: '/billing',
    match: '/billing',
    steps: [
      {
        element: '[data-tour="billing-plan"]',
        title: 'Your plan',
        description: 'See your current tier and what each plan unlocks before you change it.',
      },
      {
        title: 'Usage',
        description: 'How much of your plan’s allowance you have used this period.',
      },
      {
        element: '[data-tour="billing-history"]',
        title: 'Payment history',
        description: 'Receipts for your subscription payments, and any failed-payment notices.',
      },
    ],
  },
];

export function getTour(id: string): TourDefinition | undefined {
  return TOURS.find((t) => t.id === id);
}

/** Best tour for the current pathname (most specific match wins). */
export function tourForPath(pathname: string): TourDefinition | undefined {
  const candidates = TOURS.filter(
    (t) => t.id !== WELCOME_TOUR_ID && t.match && pathname.includes(t.match),
  );
  return candidates.sort((a, b) => (b.match?.length ?? 0) - (a.match?.length ?? 0))[0];
}
