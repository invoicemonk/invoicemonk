import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateComplianceSampleRequest {
  sample_type: 'b2b' | 'b2c'
}

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
  tax_rate: number
  tax_amount: number
}

interface IssuerSnapshot {
  legal_name: string
  name: string
  tax_id: string
  jurisdiction: string
  contact_email: string
  contact_phone: string
  address: {
    street: string
    city: string
    state: string
    country: string
    postal_code?: string
  }
  logo_url: string | null
}

interface RecipientSnapshot {
  name: string
  email: string
  phone: string
  tax_id: string | null
  address: {
    street: string
    city: string
    state: string
    country: string
  }
}

interface TaxSchemaSnapshot {
  name: string
  jurisdiction: string
  version: string
  rates: Array<{ name: string; rate: number; type: string }>
}

interface TemplateSnapshot {
  name: string
  watermark_required: boolean
  supports_branding: boolean
  tier_required: string
}

// Sample data definitions per plan specifications
const ISSUER_SNAPSHOT: IssuerSnapshot = {
  legal_name: 'TechVentures Nigeria Limited',
  name: 'TechVentures NG',
  tax_id: '12345678-0001',
  jurisdiction: 'NG',
  contact_email: 'billing@techventures.ng',
  contact_phone: '+234 1 234 5678',
  address: {
    street: '42 Broad Street',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postal_code: '101001'
  },
  logo_url: null
}

const TAX_SCHEMA_SNAPSHOT: TaxSchemaSnapshot = {
  name: 'Nigeria VAT Standard',
  jurisdiction: 'NG',
  version: '2024.1',
  rates: [{ name: 'VAT', rate: 7.5, type: 'percentage' }]
}

const TEMPLATE_SNAPSHOT: TemplateSnapshot = {
  name: 'Professional Standard',
  watermark_required: false,
  supports_branding: true,
  tier_required: 'professional'
}

// B2B/B2G recipient (business/government entity)
const B2B_RECIPIENT: RecipientSnapshot = {
  name: 'Federal Ministry of Finance',
  tax_id: 'FMF-GOV-98765',
  email: 'procurement@finance.gov.ng',
  phone: '+234 9 876 5432',
  address: {
    street: 'Central Business District',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria'
  }
}

// B2C recipient (individual)
const B2C_RECIPIENT: RecipientSnapshot = {
  name: 'Adaeze Okonkwo',
  tax_id: null,
  email: 'adaeze.okonkwo@email.com',
  phone: '+234 803 123 4567',
  address: {
    street: '15 Victoria Island Way',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria'
  }
}

// B2B line items
const B2B_ITEMS: InvoiceItem[] = [
  {
    description: 'Enterprise Software License (Annual)',
    quantity: 1,
    unit_price: 2500000,
    amount: 2500000,
    tax_rate: 7.5,
    tax_amount: 187500
  },
  {
    description: 'Implementation & Training Services',
    quantity: 40,
    unit_price: 75000,
    amount: 3000000,
    tax_rate: 7.5,
    tax_amount: 225000
  },
  {
    description: 'Premium Support Package (12 months)',
    quantity: 1,
    unit_price: 500000,
    amount: 500000,
    tax_rate: 7.5,
    tax_amount: 37500
  }
]

// B2C line items
const B2C_ITEMS: InvoiceItem[] = [
  {
    description: 'Professional Consulting Services',
    quantity: 8,
    unit_price: 50000,
    amount: 400000,
    tax_rate: 7.5,
    tax_amount: 30000
  },
  {
    description: 'Travel & Logistics (Reimbursable)',
    quantity: 1,
    unit_price: 35000,
    amount: 35000,
    tax_rate: 7.5,
    tax_amount: 2625
  }
]

// Hash generation using Web Crypto API (same algorithm as production)
async function generateInvoiceHash(invoiceNumber: string, issuedAt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(invoiceNumber + issuedAt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Check if user is platform_admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'platform_admin')
      .single()

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Platform admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: GenerateComplianceSampleRequest = await req.json()
    
    if (!body.sample_type || !['b2b', 'b2c'].includes(body.sample_type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'sample_type must be "b2b" or "b2c"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate timestamps and IDs
    const issuedAt = new Date().toISOString()
    const verificationId = crypto.randomUUID()
    const invoiceNumber = body.sample_type === 'b2b' ? 'INV-SAMPLE-B2B-001' : 'INV-SAMPLE-B2C-001'
    const invoiceHash = await generateInvoiceHash(invoiceNumber, issuedAt)

    // Select data based on sample type
    const isB2B = body.sample_type === 'b2b'
    const recipient = isB2B ? B2B_RECIPIENT : B2C_RECIPIENT
    const items = isB2B ? B2B_ITEMS : B2C_ITEMS

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0)
    const totalAmount = subtotal + taxAmount

    // Government compliance fields (explicitly marked as not submitted)
    const governmentComplianceFields = {
      irn: null,
      nrs_submission_status: 'not_submitted',
      government_signature: null,
      submission_timestamp: null
    }

    // Format currency
    const formatCurrency = (amount: number, currency: string) => {
      const localeMap: Record<string, string> = {
        'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB'
      }
      const locale = localeMap[currency] || 'en-US'
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
    }

    // Format date
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    }

    // Format address
    const formatAddressCompact = (address: RecipientSnapshot['address']): string => {
      const parts = [address.street, address.city, address.state, address.country].filter(Boolean)
      return parts.join(', ')
    }

    // Generate line items HTML
    const itemsHtml = items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unit_price, 'NGN')}</td>
        <td class="right">${item.tax_rate}%</td>
        <td class="right">${formatCurrency(item.amount, 'NGN')}</td>
      </tr>
    `).join('')

    // Generate QR code
    const appUrl = 'https://app.invoicemonk.com'
    const verificationUrl = `${appUrl}/verify/invoice/${verificationId}`
    const qrCodeHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(verificationUrl)}&format=svg" alt="QR Code" style="width: 60px; height: 60px;" />`

    // Calculate issue date and due date
    const issueDate = new Date()
    const dueDate = new Date(issueDate)
    dueDate.setDate(dueDate.getDate() + 30)

    // Generate HTML document (based on generate-pdf template with compliance enhancements)
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Compliance Sample Invoice - ${invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 12mm 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-break { page-break-inside: avoid; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      color: #1a1a1a; 
      font-size: 11px; 
      line-height: 1.35; 
    }
    .container { max-width: 100%; padding: 0; }
    
    /* Compliance Sample Banner */
    .compliance-banner {
      background: linear-gradient(135deg, #1e40af, #3b82f6);
      color: white;
      padding: 10px 16px;
      margin-bottom: 16px;
      border-radius: 4px;
      text-align: center;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .compliance-banner-sub {
      font-size: 9px;
      font-weight: 400;
      opacity: 0.9;
      margin-top: 2px;
    }
    
    /* Header - Compact two-column */
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #1a1a1a;
      margin-bottom: 16px;
    }
    .brand { font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .brand-sub { font-size: 9px; color: #666; margin-top: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #1a1a1a; }
    .invoice-number { font-size: 12px; color: #666; margin-top: 2px; }
    .status { 
      display: inline-block; 
      padding: 2px 8px; 
      border-radius: 3px; 
      font-size: 9px; 
      font-weight: 600; 
      text-transform: uppercase; 
      margin-top: 4px;
      background: #dbeafe;
      color: #1d4ed8;
    }
    
    /* Two-column layout for parties */
    .parties { 
      display: flex; 
      gap: 24px; 
      margin-bottom: 16px;
    }
    .party { flex: 1; }
    .party-label { 
      font-size: 9px; 
      font-weight: 600; 
      color: #666; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .party-name { font-size: 13px; font-weight: 600; color: #1a1a1a; }
    .party-details { font-size: 10px; color: #444; line-height: 1.4; }
    .tax-id { font-size: 9px; color: #059669; font-weight: 500; margin-top: 2px; }
    
    /* Invoice summary box */
    .summary-box {
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 16px;
    }
    .summary-row { 
      display: flex; 
      justify-content: space-between; 
      font-size: 10px; 
      color: #444;
      padding: 2px 0;
    }
    .summary-row.amount-due {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
      padding-top: 6px;
      margin-top: 4px;
      border-top: 1px solid #e5e7eb;
    }
    
    /* Table - Compact styling */
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 12px;
      font-size: 10px;
    }
    th { 
      background: #f8f9fa; 
      padding: 6px 8px; 
      text-align: left; 
      font-weight: 600; 
      font-size: 9px; 
      text-transform: uppercase; 
      color: #666;
      border-bottom: 1px solid #d1d5db;
    }
    td { 
      padding: 6px 8px; 
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    th.right, td.right { text-align: right; }
    tr:last-child td { border-bottom: 1px solid #d1d5db; }
    
    /* Totals - Right-aligned, compact */
    .totals-wrapper { 
      display: flex; 
      justify-content: flex-end; 
      margin-bottom: 16px;
    }
    .totals { width: 240px; }
    .total-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 3px 0; 
      font-size: 10px;
      color: #444;
    }
    .total-row.grand { 
      font-size: 13px; 
      font-weight: 700; 
      color: #1a1a1a;
      border-top: 2px solid #1a1a1a; 
      padding-top: 6px; 
      margin-top: 4px; 
    }
    
    /* Tax Schema Info */
    .tax-schema-info {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 16px;
      font-size: 9px;
      color: #166534;
    }
    .tax-schema-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    /* Government Compliance Fields */
    .compliance-fields {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 9px;
    }
    .compliance-fields-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 6px;
    }
    .compliance-field {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      color: #78350f;
    }
    .compliance-field-value {
      font-family: monospace;
      color: #b45309;
    }
    
    /* Integrity Notice */
    .integrity-notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 9px;
      color: #1e40af;
      text-align: center;
    }
    
    /* Footer with QR Code */
    .footer { 
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb; 
      font-size: 8px; 
      color: #888;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .footer-left { }
    .footer-right { text-align: right; }
    
    /* Hash display - full for compliance samples */
    .hash-display {
      font-family: monospace;
      font-size: 7px;
      word-break: break-all;
      max-width: 200px;
      color: #666;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Compliance Sample Banner -->
    <div class="compliance-banner">
      🏛️ COMPLIANCE SAMPLE — FOR REGULATORY REVIEW
      <div class="compliance-banner-sub">This is a demonstration invoice generated using InvoiceMonk's production rendering pipeline</div>
    </div>

    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand">${ISSUER_SNAPSHOT.legal_name}</div>
        <div class="brand-sub">${ISSUER_SNAPSHOT.name}</div>
        <div class="brand-sub">${formatAddressCompact(ISSUER_SNAPSHOT.address as RecipientSnapshot['address'])}</div>
        <div class="brand-sub">${ISSUER_SNAPSHOT.contact_email} • ${ISSUER_SNAPSHOT.contact_phone}</div>
        <div class="tax-id">Tax ID: ${ISSUER_SNAPSHOT.tax_id}</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${invoiceNumber}</div>
        <div class="status">ISSUED</div>
      </div>
    </div>

    <!-- Two-column: Bill To + Invoice Summary -->
    <div class="parties">
      <div class="party">
        <div class="party-label">Bill To${isB2B ? ' (Business/Government)' : ' (Individual)'}</div>
        <div class="party-name">${recipient.name}</div>
        <div class="party-details">
          ${formatAddressCompact(recipient.address)}<br>
          ${recipient.email} • ${recipient.phone}
        </div>
        ${recipient.tax_id ? `<div class="tax-id">Tax ID: ${recipient.tax_id}</div>` : '<div class="party-details" style="color: #9ca3af; font-style: italic;">No Tax ID (Individual)</div>'}
      </div>
      <div class="party">
        <div class="summary-box">
          <div class="summary-row">
            <span>Invoice Date</span>
            <span>${formatDate(issueDate.toISOString())}</span>
          </div>
          <div class="summary-row">
            <span>Due Date</span>
            <span>${formatDate(dueDate.toISOString())}</span>
          </div>
          <div class="summary-row">
            <span>Currency</span>
            <span>NGN</span>
          </div>
          <div class="summary-row">
            <span>Jurisdiction</span>
            <span>${ISSUER_SNAPSHOT.jurisdiction}</span>
          </div>
          <div class="summary-row amount-due">
            <span>Total Amount</span>
            <span>${formatCurrency(totalAmount, 'NGN')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="no-break">
      <thead>
        <tr>
          <th style="width: 40%;">Description</th>
          <th class="right" style="width: 10%;">Qty</th>
          <th class="right" style="width: 18%;">Unit Price</th>
          <th class="right" style="width: 12%;">Tax Rate</th>
          <th class="right" style="width: 20%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-wrapper no-break">
      <div class="totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal, 'NGN')}</span>
        </div>
        <div class="total-row">
          <span>VAT (${TAX_SCHEMA_SNAPSHOT.rates[0].rate}%)</span>
          <span>${formatCurrency(taxAmount, 'NGN')}</span>
        </div>
        <div class="total-row grand">
          <span>Total</span>
          <span>${formatCurrency(totalAmount, 'NGN')}</span>
        </div>
      </div>
    </div>

    <!-- Tax Schema Information -->
    <div class="tax-schema-info">
      <div class="tax-schema-title">Tax Schema Applied</div>
      <div>${TAX_SCHEMA_SNAPSHOT.name} • Jurisdiction: ${TAX_SCHEMA_SNAPSHOT.jurisdiction} • Version: ${TAX_SCHEMA_SNAPSHOT.version}</div>
    </div>

    <!-- Government Compliance Fields (explicitly showing not submitted status) -->
    <div class="compliance-fields">
      <div class="compliance-fields-title">🏛️ Government E-Invoicing Fields (Future Integration)</div>
      <div class="compliance-field">
        <span>Invoice Reference Number (IRN)</span>
        <span class="compliance-field-value">${governmentComplianceFields.irn || 'null (not submitted)'}</span>
      </div>
      <div class="compliance-field">
        <span>NRS Submission Status</span>
        <span class="compliance-field-value">${governmentComplianceFields.nrs_submission_status}</span>
      </div>
      <div class="compliance-field">
        <span>Government Signature</span>
        <span class="compliance-field-value">${governmentComplianceFields.government_signature || 'null (awaiting submission)'}</span>
      </div>
      <div class="compliance-field">
        <span>Submission Timestamp</span>
        <span class="compliance-field-value">${governmentComplianceFields.submission_timestamp || 'null'}</span>
      </div>
    </div>

    <!-- Integrity Notice -->
    <div class="integrity-notice">
      <strong>🔒 Integrity Guarantee</strong><br>
      This invoice is immutable and verifiable via the InvoiceMonk platform. Once issued, financial data cannot be modified. All changes are tracked in an immutable audit log.
    </div>

    <!-- Footer with QR Code and Full Hash -->
    <div class="footer">
      <div class="footer-left" style="display: flex; align-items: flex-start; gap: 10px;">
        ${qrCodeHtml}
        <div>
          <div style="font-size: 8px; font-weight: 600; margin-bottom: 4px;">Verify This Invoice</div>
          <div style="font-size: 7px; color: #666; max-width: 150px;">Scan QR code or visit verification URL to confirm authenticity</div>
          <div style="font-size: 7px; color: #3b82f6; margin-top: 4px; word-break: break-all;">${verificationUrl}</div>
        </div>
      </div>
      <div class="footer-right">
        <div style="margin-bottom: 6px;">
          <strong>Verification ID</strong><br>
          <span style="font-family: monospace; font-size: 8px;">${verificationId}</span>
        </div>
        <div>
          <strong>Invoice Hash (SHA-256)</strong>
          <div class="hash-display">${invoiceHash}</div>
        </div>
        <div style="margin-top: 8px; font-size: 7px; color: #666;">
          Generated: ${issuedAt}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

    // Log compliance sample generation to audit trail
    await supabase.rpc('log_audit_event', {
      _event_type: 'DATA_EXPORTED',
      _entity_type: 'compliance_sample',
      _entity_id: null,
      _user_id: userId,
      _business_id: null,
      _metadata: {
        sample_type: body.sample_type,
        export_type: 'compliance_sample_pdf',
        invoice_number: invoiceNumber,
        generated_at: issuedAt,
        purpose: 'regulatory_submission',
        verification_id: verificationId,
        invoice_hash: invoiceHash,
        issuer_snapshot: ISSUER_SNAPSHOT,
        recipient_snapshot: recipient,
        tax_schema_snapshot: TAX_SCHEMA_SNAPSHOT,
        template_snapshot: TEMPLATE_SNAPSHOT,
        government_compliance_fields: governmentComplianceFields,
        totals: {
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: 'NGN'
        }
      }
    })

    // Determine filename based on sample type
    const filename = body.sample_type === 'b2b' 
      ? 'invoicemonk_b2b_b2g_invoice_sample.html'
      : 'invoicemonk_b2c_invoice_sample.html'

    // Return HTML document
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Sample-Type': body.sample_type,
        'X-Invoice-Number': invoiceNumber,
        'X-Verification-ID': verificationId,
        'X-Invoice-Hash': invoiceHash,
        'X-Generated-At': issuedAt
      }
    })

  } catch (error) {
    console.error('Generate compliance sample error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while generating the compliance sample' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
