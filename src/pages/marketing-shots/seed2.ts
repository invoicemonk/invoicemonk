// Additional seed data for the second batch of marketing screenshot routes.

export const categoryColors: Record<string, { dot: string; pill: string; text: string }> = {
  'Office Supplies': { dot: 'bg-amber-500',    pill: 'bg-amber-100 text-amber-800',     text: 'text-amber-700' },
  Software:          { dot: 'bg-blue-500',     pill: 'bg-blue-100 text-blue-800',       text: 'text-blue-700' },
  Travel:            { dot: 'bg-violet-500',   pill: 'bg-violet-100 text-violet-800',   text: 'text-violet-700' },
  Meals:             { dot: 'bg-emerald-500',  pill: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-700' },
  Equipment:         { dot: 'bg-cyan-500',     pill: 'bg-cyan-100 text-cyan-800',       text: 'text-cyan-700' },
};

export const expensesByCategory = {
  'Office Supplies': [
    { vendor: 'Office Depot', date: '2026-04-24', amount: 142.80, note: 'Printer paper & toner' },
    { vendor: 'Staples',      date: '2026-04-18', amount: 86.40,  note: 'Notebooks, pens' },
    { vendor: 'Muji',         date: '2026-04-09', amount: 64.20,  note: 'Desk organizers' },
  ],
  Software: [
    { vendor: 'AWS',    date: '2026-05-07', amount: 482.10, note: 'May infrastructure' },
    { vendor: 'Figma',  date: '2026-05-04', amount: 45.00,  note: 'Design seats (3)' },
    { vendor: 'Notion', date: '2026-05-01', amount: 16.00,  note: 'Workspace plus' },
    { vendor: 'Slack',  date: '2026-04-28', amount: 87.50,  note: 'Pro plan' },
    { vendor: 'GitHub', date: '2026-04-22', amount: 84.00,  note: 'Team seats' },
  ],
  Travel: [
    { vendor: 'Lufthansa',     date: '2026-05-03', amount: 612.40, note: 'SFO → BER (client visit)' },
    { vendor: 'Hilton Berlin', date: '2026-05-02', amount: 384.00, note: '2 nights' },
    { vendor: 'Uber',          date: '2026-05-08', amount: 24.50,  note: 'Airport transfer' },
    { vendor: 'Uber',          date: '2026-04-26', amount: 18.70,  note: 'Client meeting' },
  ],
  Meals: [
    { vendor: 'Sweetgreen', date: '2026-05-06', amount: 38.20, note: 'Team lunch' },
    { vendor: 'Starbucks',  date: '2026-04-25', amount: 12.40, note: 'Client coffee' },
    { vendor: 'Uber Eats',  date: '2026-04-22', amount: 42.10, note: 'Late-night sprint' },
  ],
};

export const taxDeductibleRows = [
  { vendor: 'AWS',           date: '2026-05-07', category: 'Software',        amount: 482.10, deductible: true },
  { vendor: 'Lufthansa',     date: '2026-05-03', category: 'Travel',          amount: 612.40, deductible: true },
  { vendor: 'Hilton Berlin', date: '2026-05-02', category: 'Travel',          amount: 384.00, deductible: true },
  { vendor: 'Sweetgreen',    date: '2026-05-06', category: 'Meals',           amount: 38.20,  deductible: true,  note: '50% rule applied' },
  { vendor: 'Office Depot',  date: '2026-04-24', category: 'Office Supplies', amount: 142.80, deductible: true },
  { vendor: 'Apple Store',   date: '2026-04-29', category: 'Equipment',       amount: 1299.00, deductible: true,  note: 'Section 179' },
  { vendor: 'Whole Foods',   date: '2026-04-20', category: 'Meals',           amount: 64.30,  deductible: false, note: 'Personal' },
  { vendor: 'Figma',         date: '2026-05-04', category: 'Software',        amount: 45.00,  deductible: true },
  { vendor: 'Slack',         date: '2026-04-28', category: 'Software',        amount: 87.50,  deductible: true },
  { vendor: 'Starbucks',     date: '2026-04-25', category: 'Meals',           amount: 12.40,  deductible: true,  note: '50% rule applied' },
];

export const automationFeed = [
  { vendor: 'AWS',           date: '2026-05-07', category: 'Software',        amount: 482.10, source: 'Email receipt' },
  { vendor: 'Lufthansa',     date: '2026-05-03', category: 'Travel',          amount: 612.40, source: 'Forwarded PDF' },
  { vendor: 'Hilton Berlin', date: '2026-05-02', category: 'Travel',          amount: 384.00, source: 'Mobile capture' },
  { vendor: 'Office Depot',  date: '2026-04-24', category: 'Office Supplies', amount: 142.80, source: 'Bank match' },
  { vendor: 'Figma',         date: '2026-05-04', category: 'Software',        amount: 45.00,  source: 'Card sync' },
];

export const chartOfAccounts = [
  { group: 'Assets', total: 248450, items: [
    { code: '1000', name: 'Cash & Equivalents',     balance: 86200 },
    { code: '1100', name: 'Accounts Receivable',    balance: 124800 },
    { code: '1200', name: 'Prepaid Expenses',       balance: 8450 },
    { code: '1500', name: 'Equipment (net)',        balance: 29000 },
  ]},
  { group: 'Liabilities', total: 64200, items: [
    { code: '2000', name: 'Accounts Payable',       balance: 38400 },
    { code: '2100', name: 'VAT Payable',            balance: 14600 },
    { code: '2300', name: 'Accrued Wages',          balance: 11200 },
  ]},
  { group: 'Equity', total: 184250, items: [
    { code: '3000', name: 'Owner\u2019s Capital',   balance: 100000 },
    { code: '3500', name: 'Retained Earnings',      balance: 84250 },
  ]},
  { group: 'Revenue', total: 412800, items: [
    { code: '4000', name: 'Service Revenue',        balance: 386400 },
    { code: '4100', name: 'Retainer Revenue',       balance: 26400 },
  ]},
  { group: 'Expenses', total: 198650, items: [
    { code: '5000', name: 'Salaries & Wages',       balance: 124000 },
    { code: '5100', name: 'Software & Subscriptions', balance: 18400 },
    { code: '5200', name: 'Travel',                 balance: 22600 },
    { code: '5300', name: 'Office & Supplies',      balance: 8900 },
    { code: '5900', name: 'Other Operating',        balance: 24750 },
  ]},
];

export const plReport = {
  period: 'Q2 2026 (Apr 1 \u2013 May 9)',
  rows: [
    { kind: 'header', label: 'Revenue' },
    { kind: 'row',    label: 'Service revenue',    current: 186400, prior: 162800 },
    { kind: 'row',    label: 'Retainer revenue',   current: 26400,  prior: 22000 },
    { kind: 'total',  label: 'Total revenue',      current: 212800, prior: 184800 },
    { kind: 'header', label: 'Cost of services' },
    { kind: 'row',    label: 'Contractor fees',    current: 38200,  prior: 33400 },
    { kind: 'row',    label: 'Hosting & infra',    current: 9600,   prior: 8200 },
    { kind: 'total',  label: 'Total COGS',         current: 47800,  prior: 41600 },
    { kind: 'total',  label: 'Gross profit',       current: 165000, prior: 143200 },
    { kind: 'header', label: 'Operating expenses' },
    { kind: 'row',    label: 'Salaries & wages',   current: 62000,  prior: 58400 },
    { kind: 'row',    label: 'Software & subs.',   current: 9200,   prior: 7800 },
    { kind: 'row',    label: 'Travel',             current: 11300,  prior: 6400 },
    { kind: 'row',    label: 'Office & supplies',  current: 4450,   prior: 3900 },
    { kind: 'total',  label: 'Total opex',         current: 86950,  prior: 76500 },
    { kind: 'total',  label: 'Net income',         current: 78050,  prior: 66700, emphasize: true },
  ] as Array<{ kind: 'header'|'row'|'total'; label: string; current?: number; prior?: number; emphasize?: boolean }>,
};

export const entities = [
  { initials: 'AS', name: 'Acme Studio',         currency: 'USD', revenue: 186400, color: 'bg-primary' },
  { initials: 'MG', name: 'M\u00fcller GmbH',    currency: 'EUR', revenue: 142800, color: 'bg-blue-600' },
  { initials: 'LB', name: 'Lagos Builders Ltd', currency: 'USD', revenue: 96400,  color: 'bg-violet-600' },
];

export const bankFeedMatches = [
  { date: '2026-05-08', desc: 'STRIPE PAYOUT 8821',         amount: 9450,    matchType: 'Invoice', match: 'INV-2026-0041 \u00b7 Acme Studio' },
  { date: '2026-05-07', desc: 'AWS *AMAZON WEB SERVICES',  amount: -482.10, matchType: 'Expense', match: 'AWS \u00b7 Software' },
  { date: '2026-05-06', desc: 'WIRE IN MULLER GMBH',        amount: 14910,   matchType: 'Invoice', match: 'INV-2026-0037 \u00b7 M\u00fcller GmbH' },
  { date: '2026-05-04', desc: 'FIGMA.COM SUBSCRIPTION',     amount: -45.00,  matchType: 'Expense', match: 'Figma \u00b7 Software' },
  { date: '2026-05-03', desc: 'LUFTHANSA AIRLINES',         amount: -612.40, matchType: 'Expense', match: 'Lufthansa \u00b7 Travel' },
  { date: '2026-05-02', desc: 'HILTON BERLIN',              amount: -384.00, matchType: 'Expense', match: 'Hilton Berlin \u00b7 Travel' },
  { date: '2026-05-01', desc: 'NOTION LABS INC',            amount: -16.00,  matchType: 'Expense', match: 'Notion \u00b7 Software' },
  { date: '2026-04-29', desc: 'STRIPE PAYOUT 8814',         amount: 6800,    matchType: 'Invoice', match: 'INV-2026-0034 \u00b7 Acme Studio' },
];

export const auditTrail = [
  { actor: 'Sarah Chen',        action: 'Created invoice',          ts: 'May 9, 2026 \u00b7 09:14',  ip: '73.158.42.18' },
  { actor: 'Sarah Chen',        action: 'Sent to a.mueller@mueller-gmbh.de', ts: 'May 9, 2026 \u00b7 09:18', ip: '73.158.42.18' },
  { actor: 'System',            action: 'Email delivered',          ts: 'May 9, 2026 \u00b7 09:18',  ip: 'mx.mueller-gmbh.de' },
  { actor: 'Anna M\u00fcller',  action: 'Viewed invoice',           ts: 'May 9, 2026 \u00b7 11:42',  ip: '94.134.211.7' },
  { actor: 'Anna M\u00fcller',  action: 'Downloaded PDF',           ts: 'May 9, 2026 \u00b7 11:43',  ip: '94.134.211.7' },
  { actor: 'System',            action: 'Reminder scheduled',       ts: 'May 9, 2026 \u00b7 12:00',  ip: 'invoicemonk.app' },
];

export const jurisdictions = [
  { code: 'EU',  name: 'European Union (VAT)', last: 'May 9, 2026',  records: 312, framework: 'PEPPOL BIS 3.0' },
  { code: 'UK',  name: 'United Kingdom (MTD)', last: 'May 9, 2026',  records: 184, framework: 'HMRC Making Tax Digital' },
  { code: 'IN',  name: 'India (GST)',          last: 'May 8, 2026',  records: 96,  framework: 'GSTN e-invoicing' },
  { code: 'NG',  name: 'Nigeria (FIRS)',       last: 'May 8, 2026',  records: 142, framework: 'FIRS e-invoice' },
  { code: 'FR',  name: 'France (FE)',          last: 'May 9, 2026',  records: 78,  framework: 'Facturation \u00e9lectronique' },
  { code: 'KE',  name: 'Kenya (eTIMS)',        last: 'May 7, 2026',  records: 64,  framework: 'KRA eTIMS' },
];
