// Seed data for marketing screenshot routes. Pure data, no fetches.

export const fmt = (n: number, currency: string, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

export const muellerInvoice = {
  number: 'INV-2026-0042',
  issueDate: '2026-05-09',
  dueDate: '2026-06-08',
  currency: 'EUR',
  client: {
    name: 'Müller GmbH',
    contact: 'Anna Müller',
    email: 'a.mueller@mueller-gmbh.de',
    address: 'Friedrichstraße 112, 10117 Berlin, Germany',
    vatId: 'DE123456789',
  },
  items: [
    { desc: 'Brand identity system — discovery & strategy', qty: 1, unit: 4200, total: 4200 },
    { desc: 'Logo suite & visual language', qty: 1, unit: 3600, total: 3600 },
    { desc: 'Web design system (Figma)', qty: 40, unit: 95, total: 3800 },
  ],
  subtotal: 11600,
  vatRate: 0.19,
  vat: 2204,
  total: 13804,
};

export const lagosInvoice = {
  number: 'INV-2026-0043',
  issueDate: '2026-05-09',
  dueDate: '2026-05-23',
  currency: 'NGN',
  client: {
    name: 'Lagos Builders Ltd',
    contact: 'Chinedu Okafor',
    email: 'finance@lagosbuilders.ng',
    address: '14 Adeola Odeku St, Victoria Island, Lagos, Nigeria',
    tin: 'TIN: 20231184-0001',
  },
  items: [
    { desc: 'Site survey & feasibility report', qty: 1, unit: 850000, total: 850000 },
    { desc: 'Architectural drawings — Phase 1', qty: 1, unit: 1450000, total: 1450000 },
    { desc: 'Project management (May 2026)', qty: 80, unit: 12500, total: 1000000 },
  ],
  subtotal: 3300000,
  vatRate: 0.075,
  vat: 247500,
  total: 3547500,
};

export const globalInvoices = [
  { number: 'INV-2026-0042', client: 'Müller GmbH', currency: 'EUR', total: 13804, usd: 14910, status: 'sent', date: '2026-05-08' },
  { number: 'INV-2026-0043', client: 'Lagos Builders Ltd', currency: 'NGN', total: 3547500, usd: 2310, status: 'viewed', date: '2026-05-08' },
  { number: 'INV-2026-0041', client: 'Acme Studio', currency: 'USD', total: 9450, usd: 9450, status: 'paid', date: '2026-05-06' },
  { number: 'INV-2026-0040', client: 'Nairobi Coffee Roasters', currency: 'KES', total: 685000, usd: 5285, status: 'sent', date: '2026-05-05' },
  { number: 'INV-2026-0039', client: 'Studio Aurora SAS', currency: 'EUR', total: 5240, usd: 5660, status: 'paid', date: '2026-05-04' },
  { number: 'INV-2026-0038', client: 'Kigali Design Co', currency: 'USD', total: 3200, usd: 3200, status: 'overdue', date: '2026-04-28' },
  { number: 'INV-2026-0037', client: 'Müller GmbH', currency: 'EUR', total: 7900, usd: 8530, status: 'paid', date: '2026-04-25' },
  { number: 'INV-2026-0036', client: 'Lagos Builders Ltd', currency: 'NGN', total: 1820000, usd: 1185, status: 'paid', date: '2026-04-22' },
];

export const acmeClient = {
  name: 'Acme Studio',
  contact: 'Sarah Chen',
  email: 'sarah@acmestudio.co',
  phone: '+1 (415) 555-0142',
  address: '548 Market St, Suite 220, San Francisco, CA 94104',
  website: 'acmestudio.co',
  since: 'Client since Jan 2024',
  tags: ['Retainer', 'Top 10%', 'Net-15'],
};

export const acmeInvoices = [
  { number: 'INV-2026-0041', date: '2026-05-06', amount: 9450, status: 'paid' },
  { number: 'INV-2026-0034', date: '2026-04-12', amount: 6800, status: 'paid' },
  { number: 'INV-2026-0029', date: '2026-03-18', amount: 7200, status: 'paid' },
  { number: 'INV-2026-0024', date: '2026-02-22', amount: 3450, status: 'overdue' },
  { number: 'INV-2026-0019', date: '2026-01-30', amount: 11200, status: 'paid' },
];

export const segmentedClients = [
  { name: 'Acme Studio', revenue: 48200, outstanding: 3450, tags: ['Retainer', 'Top 10%'], lastInvoice: '2026-05-06' },
  { name: 'Müller GmbH', revenue: 41600, outstanding: 13804, tags: ['EU VAT', 'Top 10%'], lastInvoice: '2026-05-08' },
  { name: 'Lagos Builders Ltd', revenue: 38900, outstanding: 2310, tags: ['Construction', 'Net-15'], lastInvoice: '2026-05-08' },
  { name: 'Nairobi Coffee Roasters', revenue: 27500, outstanding: 5285, tags: ['Retainer'], lastInvoice: '2026-05-05' },
  { name: 'Studio Aurora SAS', revenue: 22100, outstanding: 0, tags: ['Design'], lastInvoice: '2026-05-04' },
  { name: 'Kigali Design Co', revenue: 18400, outstanding: 3200, tags: ['Overdue 30+'], lastInvoice: '2026-04-28' },
  { name: 'Helsinki Brew Lab', revenue: 14600, outstanding: 0, tags: ['New'], lastInvoice: '2026-04-19' },
  { name: 'Cape Town Studios', revenue: 12200, outstanding: 1100, tags: ['Net-30'], lastInvoice: '2026-04-15' },
];

export const estimatesByStatus = {
  Draft: [
    { id: 'EST-2026-0058', client: 'Cape Town Studios', total: 4200, currency: 'USD' },
    { id: 'EST-2026-0057', client: 'Helsinki Brew Lab', total: 6800, currency: 'EUR' },
  ],
  Sent: [
    { id: 'EST-2026-0055', client: 'Müller GmbH', total: 18400, currency: 'EUR' },
    { id: 'EST-2026-0054', client: 'Acme Studio', total: 9200, currency: 'USD' },
    { id: 'EST-2026-0053', client: 'Studio Aurora SAS', total: 5400, currency: 'EUR' },
  ],
  Viewed: [
    { id: 'EST-2026-0051', client: 'Lagos Builders Ltd', total: 2850000, currency: 'NGN' },
    { id: 'EST-2026-0050', client: 'Nairobi Coffee Roasters', total: 420000, currency: 'KES' },
  ],
  Accepted: [
    { id: 'EST-2026-0048', client: 'Acme Studio', total: 12400, currency: 'USD' },
    { id: 'EST-2026-0047', client: 'Müller GmbH', total: 8900, currency: 'EUR' },
    { id: 'EST-2026-0046', client: 'Kigali Design Co', total: 3600, currency: 'USD' },
  ],
  Declined: [
    { id: 'EST-2026-0044', client: 'Helsinki Brew Lab', total: 5200, currency: 'EUR' },
  ],
};

export const receipts = [
  { vendor: 'Uber', amount: 24.5, currency: 'USD', date: '2026-05-08', category: 'Travel' },
  { vendor: 'AWS', amount: 482.1, currency: 'USD', date: '2026-05-07', category: 'Software' },
  { vendor: 'WeWork', amount: 850.0, currency: 'USD', date: '2026-05-05', category: 'Office' },
  { vendor: 'Figma', amount: 45.0, currency: 'USD', date: '2026-05-04', category: 'Software' },
  { vendor: 'Lufthansa', amount: 612.4, currency: 'EUR', date: '2026-05-03', category: 'Travel' },
  { vendor: 'Hilton Berlin', amount: 384.0, currency: 'EUR', date: '2026-05-02', category: 'Travel' },
  { vendor: 'Notion', amount: 16.0, currency: 'USD', date: '2026-05-01', category: 'Software' },
  { vendor: 'Apple Store', amount: 1299.0, currency: 'USD', date: '2026-04-29', category: 'Equipment' },
  { vendor: 'Slack', amount: 87.5, currency: 'USD', date: '2026-04-28', category: 'Software' },
  { vendor: 'Uber', amount: 18.7, currency: 'USD', date: '2026-04-26', category: 'Travel' },
  { vendor: 'Starbucks', amount: 12.4, currency: 'USD', date: '2026-04-25', category: 'Meals' },
  { vendor: 'Office Depot', amount: 142.8, currency: 'USD', date: '2026-04-24', category: 'Office' },
];

export const uberReceipts = [
  { vendor: 'Uber', amount: 24.5, date: '2026-05-08', category: 'Travel', note: 'Airport → Office' },
  { vendor: 'Uber', amount: 18.7, date: '2026-04-26', category: 'Travel', note: 'Client meeting — Acme' },
  { vendor: 'Uber Eats', amount: 42.1, date: '2026-04-22', category: 'Meals', note: 'Team lunch (4)' },
  { vendor: 'Uber', amount: 31.2, date: '2026-04-15', category: 'Travel', note: 'Conference transit' },
  { vendor: 'Uber', amount: 22.9, date: '2026-04-09', category: 'Travel', note: 'Office → Hotel' },
];
