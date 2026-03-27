/**
 * Competitor CSV column mapping templates for the Migration Wizard.
 * Each competitor has mappings per data type (clients, invoices, expenses, products).
 * Column names map competitor CSV headers → our internal field names.
 */

export type ImportDataType = 'clients' | 'invoices' | 'expenses' | 'products';

export interface CompetitorTemplate {
  id: string;
  name: string;
  supportedTypes: ImportDataType[];
  exportInstructions: string;
  mappings: Partial<Record<ImportDataType, Record<string, string>>>;
}

export const COMPETITOR_TEMPLATES: CompetitorTemplate[] = [
  {
    id: 'zoho',
    name: 'Zoho Invoice',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Zoho Invoice, go to Contacts > Export or Invoices > Export to download CSV files.',
    mappings: {
      clients: {
        'Customer Name': 'name',
        'Company Name': 'name',
        'Email': 'email',
        'Phone': 'phone',
        'Contact Person': 'contact_person',
        'Tax ID': 'tax_id',
        'Notes': 'notes',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice Date': 'issue_date',
        'Due Date': 'due_date',
        'Customer Name': 'client_name',
        'Customer Email': 'client_email',
        'Item Name': 'item_description',
        'Item Description': 'item_description',
        'Quantity': 'item_quantity',
        'Rate': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax': 'item_tax_rate',
        'Total': 'total_amount',
        'Currency': 'currency',
        'Notes': 'notes',
        'Terms & Conditions': 'terms',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Date': 'expense_date',
        'Notes': 'notes',
        'Expense Account': 'category',
      },
      products: {
        'Item Name': 'name',
        'Description': 'description',
        'Rate': 'default_price',
        'Unit': 'type',
        'Tax': 'tax_rate',
        'SKU': 'sku',
      },
    },
  },
  {
    id: 'wave',
    name: 'Wave',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Wave, go to Sales > Invoices > Export, or Accounting > Transactions > Export.',
    mappings: {
      clients: {
        'Customer': 'name',
        'Customer Name': 'name',
        'Email': 'email',
        'Phone Number': 'phone',
        'Contact First Name': 'contact_person',
        'Contact Last Name': 'contact_person',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice Date': 'issue_date',
        'Due Date': 'due_date',
        'Customer': 'client_name',
        'Description': 'item_description',
        'Quantity': 'item_quantity',
        'Price': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax Name': 'item_tax_label',
        'Tax Rate': 'item_tax_rate',
        'Total': 'total_amount',
        'Currency': 'currency',
        'Memo': 'notes',
      },
      expenses: {
        'Account': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Date': 'expense_date',
        'Notes': 'notes',
        'Transaction Date': 'expense_date',
      },
      products: {
        'Product / Service': 'name',
        'Description': 'description',
        'Price': 'default_price',
        'Tax': 'tax_rate',
      },
    },
  },
  {
    id: 'invoicely',
    name: 'Invoicely',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Invoicely, go to each section (Clients, Invoices, etc.) and click "Export to CSV".',
    mappings: {
      clients: {
        'Client Name': 'name',
        'Name': 'name',
        'Email Address': 'email',
        'Email': 'email',
        'Phone': 'phone',
        'Contact': 'contact_person',
        'Tax Number': 'tax_id',
      },
      invoices: {
        'Invoice #': 'invoice_number',
        'Invoice Number': 'invoice_number',
        'Date': 'issue_date',
        'Due Date': 'due_date',
        'Client': 'client_name',
        'Client Name': 'client_name',
        'Item': 'item_description',
        'Description': 'item_description',
        'Qty': 'item_quantity',
        'Price': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax %': 'item_tax_rate',
        'Total': 'total_amount',
        'Currency': 'currency',
        'Notes': 'notes',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Merchant': 'vendor',
        'Date': 'expense_date',
        'Notes': 'notes',
      },
      products: {
        'Name': 'name',
        'Description': 'description',
        'Price': 'default_price',
        'Tax Rate': 'tax_rate',
      },
    },
  },
  {
    id: 'invoice_simple',
    name: 'Invoice Simple',
    supportedTypes: ['clients', 'invoices'],
    exportInstructions: 'In Invoice Simple, go to Invoices and use the export option to download your data as CSV.',
    mappings: {
      clients: {
        'Bill To': 'name',
        'Client Name': 'name',
        'Client Email': 'email',
        'Phone': 'phone',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice #': 'invoice_number',
        'Date': 'issue_date',
        'Due Date': 'due_date',
        'Bill To': 'client_name',
        'Item': 'item_description',
        'Quantity': 'item_quantity',
        'Rate': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax': 'item_tax_rate',
        'Total': 'total_amount',
      },
    },
  },
  {
    id: 'moon_invoice',
    name: 'Moon Invoice',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Moon Invoice, go to Settings > Data > Export to download CSV files for each data type.',
    mappings: {
      clients: {
        'Client Name': 'name',
        'Company': 'name',
        'Email': 'email',
        'Phone': 'phone',
        'Contact Person': 'contact_person',
        'Tax ID': 'tax_id',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice Date': 'issue_date',
        'Due Date': 'due_date',
        'Client Name': 'client_name',
        'Item Description': 'item_description',
        'Quantity': 'item_quantity',
        'Unit Price': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax Rate': 'item_tax_rate',
        'Total Amount': 'total_amount',
        'Currency': 'currency',
        'Notes': 'notes',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Date': 'expense_date',
        'Notes': 'notes',
      },
      products: {
        'Product Name': 'name',
        'Description': 'description',
        'Price': 'default_price',
        'Tax Rate': 'tax_rate',
        'SKU': 'sku',
      },
    },
  },
  {
    id: 'invoice_ninja',
    name: 'Invoice Ninja',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Invoice Ninja, go to Settings > Import/Export > Export to download CSV files.',
    mappings: {
      clients: {
        'client.name': 'name',
        'client.contact_email': 'email',
        'client.phone': 'phone',
        'client.vat_number': 'tax_id',
        'client.public_notes': 'notes',
        'Name': 'name',
        'Email': 'email',
        'Phone': 'phone',
        'VAT Number': 'tax_id',
      },
      invoices: {
        'invoice.number': 'invoice_number',
        'invoice.date': 'issue_date',
        'invoice.due_date': 'due_date',
        'invoice.client': 'client_name',
        'item.product_key': 'item_description',
        'item.notes': 'item_description',
        'item.quantity': 'item_quantity',
        'item.cost': 'item_unit_price',
        'item.line_total': 'item_amount',
        'item.tax_rate1': 'item_tax_rate',
        'item.tax_name1': 'item_tax_label',
        'invoice.amount': 'total_amount',
        'Invoice Number': 'invoice_number',
        'Date': 'issue_date',
        'Due Date': 'due_date',
        'Client': 'client_name',
        'Amount': 'total_amount',
      },
      expenses: {
        'expense.category': 'category',
        'expense.amount': 'amount',
        'expense.public_notes': 'description',
        'expense.vendor': 'vendor',
        'expense.date': 'expense_date',
        'expense.private_notes': 'notes',
        'Category': 'category',
        'Amount': 'amount',
        'Vendor': 'vendor',
        'Date': 'expense_date',
      },
      products: {
        'product.product_key': 'name',
        'product.notes': 'description',
        'product.price': 'default_price',
        'product.tax_rate1': 'tax_rate',
        'Product': 'name',
        'Notes': 'description',
        'Price': 'default_price',
      },
    },
  },
  {
    id: 'invoicera',
    name: 'Invoicera',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Invoicera, go to each module and use the Export option to download CSV files.',
    mappings: {
      clients: {
        'Client Name': 'name',
        'Email': 'email',
        'Phone': 'phone',
        'Contact Person': 'contact_person',
        'Tax ID': 'tax_id',
        'Notes': 'notes',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice Date': 'issue_date',
        'Due Date': 'due_date',
        'Client': 'client_name',
        'Item': 'item_description',
        'Qty': 'item_quantity',
        'Rate': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax': 'item_tax_rate',
        'Total': 'total_amount',
        'Currency': 'currency',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Date': 'expense_date',
        'Notes': 'notes',
      },
      products: {
        'Item Name': 'name',
        'Description': 'description',
        'Rate': 'default_price',
        'Tax': 'tax_rate',
      },
    },
  },
  {
    id: 'slickpie',
    name: 'SlickPie',
    supportedTypes: ['clients', 'expenses'],
    exportInstructions: 'In SlickPie, go to Reports and export your data as CSV.',
    mappings: {
      clients: {
        'Customer Name': 'name',
        'Email': 'email',
        'Phone': 'phone',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Date': 'expense_date',
        'Memo': 'notes',
      },
    },
  },
  {
    id: 'stripe',
    name: 'Stripe',
    supportedTypes: ['clients', 'invoices'],
    exportInstructions: 'In Stripe, go to Payments > All payments > Export, or Customers > Export to download CSV.',
    mappings: {
      clients: {
        'Customer Name': 'name',
        'Customer Email': 'email',
        'Email': 'email',
        'Name': 'name',
        'Phone': 'phone',
        'Description': 'notes',
      },
      invoices: {
        'Number': 'invoice_number',
        'Invoice Number': 'invoice_number',
        'Created (UTC)': 'issue_date',
        'Created': 'issue_date',
        'Due Date': 'due_date',
        'Customer Name': 'client_name',
        'Customer Email': 'client_email',
        'Description': 'item_description',
        'Quantity': 'item_quantity',
        'Unit Price': 'item_unit_price',
        'Amount': 'total_amount',
        'Amount Due': 'total_amount',
        'Currency': 'currency',
        'Memo': 'notes',
      },
    },
  },
  {
    id: 'paypal',
    name: 'PayPal',
    supportedTypes: ['clients', 'invoices'],
    exportInstructions: 'In PayPal, go to Activity > Statements > Download and select CSV format.',
    mappings: {
      clients: {
        'Name': 'name',
        'To Email Address': 'email',
        'Email': 'email',
        'Phone': 'phone',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice ID': 'invoice_number',
        'Invoice Date': 'issue_date',
        'Date': 'issue_date',
        'Due Date': 'due_date',
        'Recipient': 'client_name',
        'Bill To': 'client_name',
        'To Email Address': 'client_email',
        'Item Title': 'item_description',
        'Description': 'item_description',
        'Quantity': 'item_quantity',
        'Item Price': 'item_unit_price',
        'Amount': 'total_amount',
        'Gross': 'total_amount',
        'Currency': 'currency',
        'Note': 'notes',
      },
    },
  },
  {
    id: 'stampli',
    name: 'Stampli',
    supportedTypes: ['invoices', 'expenses'],
    exportInstructions: 'In Stampli, go to the Invoices list and use the Export option to download CSV.',
    mappings: {
      invoices: {
        'Invoice Number': 'invoice_number',
        'Invoice #': 'invoice_number',
        'Invoice Date': 'issue_date',
        'Due Date': 'due_date',
        'Vendor': 'client_name',
        'Vendor Name': 'client_name',
        'Description': 'item_description',
        'Line Amount': 'item_amount',
        'Total': 'total_amount',
        'Amount': 'total_amount',
        'Currency': 'currency',
      },
      expenses: {
        'GL Account': 'category',
        'Category': 'category',
        'Amount': 'amount',
        'Line Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Vendor Name': 'vendor',
        'Date': 'expense_date',
        'Invoice Date': 'expense_date',
      },
    },
  },
  {
    id: 'payoneer',
    name: 'Payoneer',
    supportedTypes: ['invoices'],
    exportInstructions: 'In Payoneer, go to Activity > Statements and download transaction history as CSV.',
    mappings: {
      invoices: {
        'Transaction ID': 'invoice_number',
        'Date': 'issue_date',
        'Description': 'item_description',
        'Amount': 'total_amount',
        'Currency': 'currency',
        'From': 'client_name',
        'Payer': 'client_name',
      },
    },
  },
  {
    id: 'monk',
    name: 'Monk',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Monk, go to Settings > Export Data and download your CSV files.',
    mappings: {
      clients: {
        'Client Name': 'name',
        'Name': 'name',
        'Email': 'email',
        'Phone': 'phone',
        'Contact Person': 'contact_person',
        'Tax ID': 'tax_id',
        'Notes': 'notes',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Date': 'issue_date',
        'Due Date': 'due_date',
        'Client': 'client_name',
        'Client Name': 'client_name',
        'Item': 'item_description',
        'Description': 'item_description',
        'Quantity': 'item_quantity',
        'Unit Price': 'item_unit_price',
        'Price': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax Rate': 'item_tax_rate',
        'Total': 'total_amount',
        'Currency': 'currency',
        'Notes': 'notes',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Date': 'expense_date',
        'Notes': 'notes',
      },
      products: {
        'Name': 'name',
        'Description': 'description',
        'Price': 'default_price',
        'Tax Rate': 'tax_rate',
        'SKU': 'sku',
      },
    },
  },
  {
    id: 'invoicemonk',
    name: 'Invoicemonk (Re-import)',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'In Invoicemonk, go to each section and use the Export button to download your CSV.',
    mappings: {
      clients: {
        'Name': 'name',
        'Email': 'email',
        'Phone': 'phone',
        'Contact Person': 'contact_person',
        'Tax ID': 'tax_id',
        'Notes': 'notes',
      },
      invoices: {
        'Invoice Number': 'invoice_number',
        'Issue Date': 'issue_date',
        'Due Date': 'due_date',
        'Client Name': 'client_name',
        'Client Email': 'client_email',
        'Description': 'item_description',
        'Quantity': 'item_quantity',
        'Unit Price': 'item_unit_price',
        'Amount': 'item_amount',
        'Tax Rate': 'item_tax_rate',
        'Tax Label': 'item_tax_label',
        'Total Amount': 'total_amount',
        'Currency': 'currency',
        'Notes': 'notes',
        'Terms': 'terms',
      },
      expenses: {
        'Category': 'category',
        'Amount': 'amount',
        'Description': 'description',
        'Vendor': 'vendor',
        'Expense Date': 'expense_date',
        'Notes': 'notes',
      },
      products: {
        'Name': 'name',
        'Description': 'description',
        'Default Price': 'default_price',
        'Tax Rate': 'tax_rate',
        'SKU': 'sku',
        'Type': 'type',
      },
    },
  },
  {
    id: 'generic',
    name: 'Other / Generic CSV',
    supportedTypes: ['clients', 'invoices', 'expenses', 'products'],
    exportInstructions: 'Upload any CSV file and manually map columns to the correct fields.',
    mappings: {},
  },
];

/**
 * Apply a competitor template to auto-map CSV columns.
 * Returns a mapping of csvColumn → dbField.
 * Falls back to fuzzy matching for unmapped columns.
 */
export function applyTemplate(
  competitorId: string,
  dataType: ImportDataType,
  csvColumns: string[]
): Record<string, string> {
  const competitor = COMPETITOR_TEMPLATES.find((t) => t.id === competitorId);
  const templateMap = competitor?.mappings[dataType] || {};
  const result: Record<string, string> = {};

  for (const col of csvColumns) {
    // Exact match first
    if (templateMap[col]) {
      result[col] = templateMap[col];
      continue;
    }
    // Case-insensitive match
    const lowerCol = col.toLowerCase();
    const match = Object.entries(templateMap).find(
      ([key]) => key.toLowerCase() === lowerCol
    );
    if (match) {
      result[col] = match[1];
      continue;
    }
    // Fuzzy fallback
    const cleaned = lowerCol.replace(/[^a-z]/g, '');
    if (cleaned.includes('category') || cleaned.includes('account')) result[col] = dataType === 'expenses' ? 'category' : '';
    else if (cleaned.includes('amount') || cleaned.includes('price') || cleaned.includes('cost') || cleaned.includes('rate')) {
      if (dataType === 'products') result[col] = 'default_price';
      else if (dataType === 'expenses') result[col] = 'amount';
    }
    else if (cleaned.includes('description') || cleaned.includes('desc')) result[col] = dataType === 'products' ? 'description' : 'description';
    else if (cleaned.includes('vendor') || cleaned.includes('supplier') || cleaned.includes('merchant')) result[col] = 'vendor';
    else if (cleaned.includes('date')) result[col] = dataType === 'expenses' ? 'expense_date' : 'issue_date';
    else if (cleaned === 'name' || cleaned.includes('clientname') || cleaned.includes('companyname') || cleaned.includes('customername')) result[col] = 'name';
    else if (cleaned.includes('email')) result[col] = 'email';
    else if (cleaned.includes('phone') || cleaned.includes('tel')) result[col] = 'phone';
    else if (cleaned.includes('contact')) result[col] = 'contact_person';
    else if (cleaned.includes('tax') || cleaned.includes('tin') || cleaned.includes('vat')) result[col] = dataType === 'products' ? 'tax_rate' : 'tax_id';
    else if (cleaned.includes('note') || cleaned.includes('memo')) result[col] = 'notes';
    else if (cleaned.includes('sku')) result[col] = 'sku';
    else if (cleaned.includes('quantity') || cleaned.includes('qty')) result[col] = 'item_quantity';
    else if (cleaned.includes('invoice') && cleaned.includes('number')) result[col] = 'invoice_number';
    else if (cleaned.includes('due')) result[col] = 'due_date';
    else if (cleaned.includes('currency')) result[col] = 'currency';
    else if (cleaned.includes('total')) result[col] = 'total_amount';
  }

  return result;
}
