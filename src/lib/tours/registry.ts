/**
 * Registry of all in-app guided tours.
 *
 * Steps target elements via CSS selectors — prefer stable `data-tour="..."`
 * attributes, falling back to structural selectors. Steps whose element is
 * absent are skipped automatically by the tour engine, so it's safe to list
 * optional cards / plan-gated features.
 */

export interface TourStep {
  /** CSS selector for the element to highlight. Omit for a centered step. */
  element?: string;
  title: string;
  description: string;
}

export interface TourDefinition {
  id: string;
  label: string;
  description: string;
  /** Path suffix used to match the current route, e.g. '/invoices'. */
  match?: string;
  /** Relative path (appended to /b/:businessId) to navigate to first. */
  path?: string;
  steps: TourStep[];
}

export const WELCOME_TOUR_ID = 'welcome';

export const TOURS: TourDefinition[] = [
  {
    id: WELCOME_TOUR_ID,
    label: 'Welcome tour',
    description: 'A quick lap around Invoicemonk — start here',
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
    path: '/dashboard',
    match: '/dashboard',
    steps: [
      {
        element: '[data-tour="dashboard-stats"]',
        title: 'Key figures',
        description:
          'Revenue, outstanding amounts, overdue invoices and paid totals for the period you select.',
      },
      {
        element: '[data-tour="dashboard-range"]',
        title: 'Change the period',
        description: 'Switch the date range to compare months, quarters or a custom window.',
      },
      {
        element: '[data-tour="quick-setup"]',
        title: 'Setup checklist',
        description: 'Any compliance gaps in your profile show up here until they are resolved.',
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
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    description: 'Create, issue and track invoices',
    path: '/invoices',
    match: '/invoices',
    steps: [
      {
        element: '[data-tour="nav-invoices"]',
        title: 'Invoice list',
        description: 'Every invoice for this business and currency account, newest first.',
      },
      {
        element: '[data-tour="invoice-new"]',
        title: 'Create an invoice',
        description:
          'Start a draft here. Drafts can be edited freely; issuing locks the invoice and assigns its legal number.',
      },
      {
        element: '[data-tour="invoice-filters"]',
        title: 'Find anything fast',
        description: 'Filter by status, client or date range, or search by invoice number.',
      },
      {
        element: 'main table',
        title: 'Statuses explained',
        description:
          'Draft, issued, sent, viewed, paid, voided or credited — the badge tells you exactly where an invoice stands.',
      },
      {
        title: 'Corrections',
        description:
          'Issued invoices cannot be edited or deleted. Use a credit note to correct or cancel one — that keeps your audit trail intact.',
      },
    ],
  },
  {
    id: 'invoice-new',
    label: 'Creating an invoice',
    description: 'Walk through the invoice form',
    path: '/invoices/new',
    match: '/invoices/new',
    steps: [
      {
        element: '[data-tour="invoice-form-client"]',
        title: 'Pick the client',
        description: 'Choose an existing client or create one inline — their details print on the invoice.',
      },
      {
        element: '[data-tour="invoice-form-dates"]',
        title: 'Dates and terms',
        description: 'Issue date and due date drive payment reminders and your overdue reporting.',
      },
      {
        element: '[data-tour="invoice-form-items"]',
        title: 'Line items',
        description:
          'Add products or services with quantity, unit price and tax rate. Saved items autofill for next time.',
      },
      {
        element: '[data-tour="invoice-form-totals"]',
        title: 'Totals and tax',
        description: 'Subtotal, tax and total are calculated for you using your jurisdiction rules.',
      },
      {
        element: '[data-tour="invoice-form-actions"]',
        title: 'Save or issue',
        description:
          'Save as a draft to keep editing, or issue it to lock the invoice, assign its number and generate its verification page and QR code.',
      },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Manage who you bill',
    path: '/clients',
    match: '/clients',
    steps: [
      {
        element: '[data-tour="client-new"]',
        title: 'Add a client',
        description:
          'Legal name, address and (for B2B) tax ID. These are legally required on invoices in most countries.',
      },
      {
        element: 'main table',
        title: 'Client records',
        description: 'Open a client to see their invoices, payment history and contact details.',
      },
    ],
  },
  {
    id: 'products',
    label: 'Products & services',
    description: 'Reusable line items',
    path: '/products',
    match: '/products',
    steps: [
      {
        element: '[data-tour="product-new"]',
        title: 'Save what you sell',
        description:
          'Store name, unit price and tax rate once, then add it to any invoice in a couple of clicks.',
      },
      {
        element: 'main table',
        title: 'Your catalogue',
        description: 'Products and services are scoped to the active currency account.',
      },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    description: 'Track what you spend',
    path: '/expenses',
    match: '/expenses',
    steps: [
      {
        title: 'Record an expense',
        description: 'Amount, vendor, category and date — with the receipt attached for your records.',
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
    id: 'receipts',
    label: 'Receipts',
    description: 'Proof of payment for your clients',
    path: '/receipts',
    match: '/receipts',
    steps: [
      {
        element: 'main table',
        title: 'Issued receipts',
        description:
          'A receipt is created automatically when you record a payment, and can be emailed to the client.',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Tax and revenue reporting',
    path: '/reports',
    match: '/reports',
    steps: [
      {
        element: '[data-tour="reports-tabs"]',
        title: 'Report types',
        description: 'Revenue, tax summaries and client breakdowns for any period.',
      },
      {
        title: 'Export and share',
        description: 'Download as CSV or PDF, or email a report straight to your accountant.',
      },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Books, ledger and statements',
    path: '/accounting',
    match: '/accounting',
    steps: [
      {
        title: 'Your books',
        description:
          'Invoices, payments and expenses post here automatically — no double entry by hand.',
      },
      {
        title: 'Statements',
        description: 'Chart of accounts, ledger and financial statements for the selected period.',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Business settings',
    description: 'Profile, tax ID, logo, payment methods',
    path: '/settings',
    match: '/settings',
    steps: [
      {
        element: '[data-tour="settings-profile"]',
        title: 'Business profile',
        description:
          'Name, country, address, tax ID and logo. These print on every invoice, so keep them accurate.',
      },
      {
        title: 'Payment methods',
        description: 'Bank details or payment instructions shown to clients on their invoices.',
      },
      {
        title: 'Team access',
        description: 'Invite colleagues and give them owner, admin, member or auditor access.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Plan & billing',
    description: 'Your subscription and invoices from us',
    path: '/billing',
    match: '/billing',
    steps: [
      {
        title: 'Your plan',
        description: 'See your current tier and what each plan unlocks before you change it.',
      },
      {
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
