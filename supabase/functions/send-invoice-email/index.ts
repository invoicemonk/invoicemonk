import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendInvoiceRequest {
  invoice_id: string
  recipient_email: string
  custom_message?: string
  app_url?: string // Optional: client-provided base URL for verification links
}

interface IssuerSnapshot {
  legal_name?: string
  name?: string
  contact_email?: string
  contact_phone?: string
  logo_url?: string
  tax_id?: string
  address?: {
    line1?: string
    street?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
  }
}

interface RecipientSnapshot {
  name?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    street?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
  }
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  tax_rate: number
  tax_amount: number
  discount_percent: number
}

interface TemplateSnapshot {
  id?: string
  name?: string
  watermark_required?: boolean
  supports_branding?: boolean
  tier_required?: string
}

// Helper: Format currency with proper locale
const formatCurrency = (amount: number, currency: string): string => {
  const localeMap: Record<string, string> = {
    'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
    'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
    'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
  }
  const locale = localeMap[currency] || 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

// Helper: Format date
const formatDate = (date: string | null): string => {
  if (!date) return 'Not specified'
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  })
}

// Helper: Format address compactly
const formatAddressCompact = (address: IssuerSnapshot['address'] | RecipientSnapshot['address']): string => {
  if (!address) return ''
  const parts = [
    address.line1 || address.street,
    address.city,
    address.state,
    address.country
  ].filter(Boolean)
  return parts.join(', ')
}

// Professional HTML template matching generate-pdf output
const generateProfessionalHtml = (
  invoice: Record<string, unknown>,
  items: InvoiceItem[],
  issuerSnapshot: IssuerSnapshot | null,
  recipientSnapshot: RecipientSnapshot | null,
  verificationUrl: string | null,
  showWatermark: boolean,
  canUseBranding: boolean
): string => {
  const currency = invoice.currency as string
  const balanceDue = (invoice.total_amount as number) - ((invoice.amount_paid as number) || 0)
  
  // Issuer info
  const issuerName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk User'
  const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
  const issuerEmail = issuerSnapshot?.contact_email || ''
  const issuerPhone = issuerSnapshot?.contact_phone || ''
  // ALWAYS show logo if available (regardless of branding tier)
  const issuerLogoUrl = issuerSnapshot?.logo_url || null
  
  // Recipient info
  const recipientName = recipientSnapshot?.name || 'Client'
  const recipientEmail = recipientSnapshot?.email || ''
  const recipientAddress = formatAddressCompact(recipientSnapshot?.address)
  
  // Status colors
  const statusColors: Record<string, { bg: string; color: string }> = {
    'issued': { bg: '#dbeafe', color: '#1d4ed8' },
    'sent': { bg: '#e0e7ff', color: '#4338ca' },
    'viewed': { bg: '#fef3c7', color: '#d97706' },
    'paid': { bg: '#d1fae5', color: '#059669' },
    'voided': { bg: '#fee2e2', color: '#dc2626' },
    'credited': { bg: '#fce7f3', color: '#db2777' }
  }
  const statusStyle = statusColors[invoice.status as string] || statusColors['issued']
  
  // Generate items HTML
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${formatCurrency(item.unit_price, currency)}</td>
      <td class="right">${formatCurrency(item.amount, currency)}</td>
    </tr>
  `).join('')
  
  // QR code
  const qrCodeHtml = verificationUrl 
    ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(verificationUrl)}&format=svg" alt="QR Code" style="width: 50px; height: 50px;" />`
    : ''
  
  // Verification info
  const verificationLine = invoice.verification_id 
    ? `Verification: ${(invoice.verification_id as string).substring(0, 8)}...` 
    : ''
  const hashLine = invoice.invoice_hash 
    ? `Hash: ${(invoice.invoice_hash as string).substring(0, 12)}...` 
    : ''
  
  // Watermark
  const watermarkHtml = showWatermark ? `<div class="watermark">INVOICEMONK</div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
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
    .totals { width: 220px; }
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
    .total-row.paid { color: #059669; }
    .total-row.balance { 
      font-weight: 600; 
      background: #fef3c7;
      padding: 4px 6px;
      margin: 4px -6px 0;
      border-radius: 3px;
    }
    
    /* Notes section - compact */
    .notes-section { 
      margin-bottom: 12px;
      padding: 8px 10px;
      background: #fafafa;
      border-radius: 4px;
    }
    .notes-label { 
      font-size: 9px; 
      font-weight: 600; 
      color: #666; 
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .notes-content { font-size: 10px; color: #444; }
    
    /* Footer - Single compact line */
    .footer { 
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb; 
      font-size: 8px; 
      color: #888;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { }
    .footer-right { text-align: right; }
    
    /* Watermark */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 60px;
      color: rgba(0,0,0,0.04);
      font-weight: 700;
      z-index: -1;
      white-space: nowrap;
      pointer-events: none;
    }
  </style>
</head>
<body>
  ${watermarkHtml}
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 40px; max-width: 100px; object-fit: contain;" />` : ''}
        <div>
          <div class="brand">${issuerName}</div>
          ${!canUseBranding ? '<div class="brand-sub">Powered by Invoicemonk</div>' : ''}
          ${issuerAddress ? `<div class="brand-sub">${issuerAddress}</div>` : ''}
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div class="status" style="background: ${statusStyle.bg}; color: ${statusStyle.color};">${(invoice.status as string).toUpperCase()}</div>
      </div>
    </div>

    <!-- Two-column: Bill To + Invoice Summary -->
    <div class="parties">
      <div class="party">
        <div class="party-label">Bill To</div>
        <div class="party-name">${recipientName}</div>
        <div class="party-details">
          ${recipientAddress ? `${recipientAddress}<br>` : ''}
          ${recipientEmail ? `${recipientEmail}` : ''}
        </div>
      </div>
      <div class="party">
        <div class="summary-box">
          <div class="summary-row">
            <span>Invoice Date</span>
            <span>${formatDate(invoice.issue_date as string)}</span>
          </div>
          <div class="summary-row">
            <span>Due Date</span>
            <span>${formatDate(invoice.due_date as string)}</span>
          </div>
          <div class="summary-row">
            <span>Currency</span>
            <span>${currency}</span>
          </div>
          <div class="summary-row amount-due">
            <span>Amount Due</span>
            <span>${formatCurrency(balanceDue, currency)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="no-break">
      <thead>
        <tr>
          <th style="width: 55%;">Description</th>
          <th class="right" style="width: 10%;">Qty</th>
          <th class="right" style="width: 17%;">Rate</th>
          <th class="right" style="width: 18%;">Amount</th>
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
          <span>${formatCurrency(invoice.subtotal as number, currency)}</span>
        </div>
        ${(invoice.tax_amount as number) > 0 ? `
        <div class="total-row">
          <span>Tax</span>
          <span>${formatCurrency(invoice.tax_amount as number, currency)}</span>
        </div>
        ` : ''}
        ${(invoice.discount_amount as number) > 0 ? `
        <div class="total-row">
          <span>Discount</span>
          <span>-${formatCurrency(invoice.discount_amount as number, currency)}</span>
        </div>
        ` : ''}
        <div class="total-row grand">
          <span>Total</span>
          <span>${formatCurrency(invoice.total_amount as number, currency)}</span>
        </div>
        ${(invoice.amount_paid as number) > 0 ? `
        <div class="total-row paid">
          <span>Paid</span>
          <span>-${formatCurrency(invoice.amount_paid as number, currency)}</span>
        </div>
        <div class="total-row balance">
          <span>Balance Due</span>
          <span>${formatCurrency(balanceDue, currency)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    ${invoice.notes || invoice.terms ? `
    <!-- Notes/Terms -->
    <div class="notes-section no-break">
      ${invoice.notes ? `
      <div class="notes-label">Notes</div>
      <div class="notes-content">${invoice.notes}</div>
      ` : ''}
      ${invoice.notes && invoice.terms ? '<div style="height: 8px;"></div>' : ''}
      ${invoice.terms ? `
      <div class="notes-label">Terms</div>
      <div class="notes-content">${invoice.terms}</div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Footer with QR Code -->
    <div class="footer">
      <div class="footer-left" style="display: flex; align-items: center; gap: 8px;">
        ${verificationUrl && qrCodeHtml ? `
        <div style="display: flex; align-items: center; gap: 6px;">
          ${qrCodeHtml}
          <span style="font-size: 7px; max-width: 80px;">Scan to verify invoice authenticity</span>
        </div>
        ` : ''}
      </div>
      <div class="footer-right">
        ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}
        <br>
        ${verificationLine}${verificationLine && hashLine ? ' • ' : ''}${hashLine}
        ${showWatermark ? '<br>Upgrade to remove branding' : ''}
      </div>
    </div>
  </div>
</body>
</html>`
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

    // Create Supabase client
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

    // Parse request body
    const body: SendInvoiceRequest = await req.json()
    
    if (!body.invoice_id || !body.recipient_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice ID and recipient email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Brevo API key
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email sending is not configured. Please configure BREVO_API_KEY.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoice with items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`*, clients (*), invoice_items (*)`)
      .eq('id', body.invoice_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only issued invoices can be sent
    if (invoice.status === 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot send draft invoices. Please issue the invoice first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse snapshots
    const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null
    const templateSnapshot = invoice.template_snapshot as TemplateSnapshot | null
    const items = (invoice.invoice_items || []) as InvoiceItem[]
    
    const businessName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk'
    const clientName = recipientSnapshot?.name || invoice.clients?.name || 'Valued Customer'
    const invoiceSummary = invoice.summary as string | null

    // Format issuer address for email
    const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    // ALWAYS show logo if available (regardless of branding tier)
    const issuerLogoUrl = issuerSnapshot?.logo_url || null

    // Get user's subscription tier for watermark/branding logic
    const { data: tierResult, error: tierError } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'remove_watermark'
    })

    if (tierError) {
      console.error('Tier check error:', tierError)
    }

    const tierData = typeof tierResult === 'object' && tierResult !== null ? tierResult : { allowed: false, tier: 'starter' }
    const canRemoveWatermark = tierData.allowed === true

    // Check branding permission
    const { data: brandingResult } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'custom_branding'
    })
    const brandingData = typeof brandingResult === 'object' && brandingResult !== null ? brandingResult : { allowed: false }
    const canUseBranding = brandingData.allowed === true && templateSnapshot?.supports_branding !== false

    // Determine watermark
    const templateRequiresWatermark = templateSnapshot?.watermark_required !== false
    const showWatermark = templateRequiresWatermark && !canRemoveWatermark

    // Verification URL - prefer client-provided app_url, then env, then fallback
    const appUrl = body.app_url || Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    const verificationUrl = invoice.verification_id 
      ? `${appUrl}/verify/invoice/${invoice.verification_id}`
      : null
    
    // QR code for email body
    const qrCodeUrl = verificationUrl 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=png`
      : null

    // Generate professional HTML (matching generate-pdf output)
    console.log('Generating professional HTML invoice attachment...')
    const professionalHtml = generateProfessionalHtml(
      invoice,
      items,
      issuerSnapshot,
      recipientSnapshot,
      verificationUrl,
      showWatermark,
      canUseBranding
    )
    
    // Convert HTML to PDF using PDFShift API
    const pdfshiftApiKey = Deno.env.get('PDFSHIFT_API_KEY')
    let attachmentContent: string
    let attachmentName: string
    let attachmentType: 'pdf' | 'html' = 'html'

    if (pdfshiftApiKey) {
      console.log('Converting HTML to PDF via PDFShift...')
      try {
        const pdfResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${pdfshiftApiKey}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: professionalHtml,
            format: 'A4',
            margin: '10mm',
          }),
        })

        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer()
          // Convert to base64
          const pdfBytes = new Uint8Array(pdfBuffer)
          let binary = ''
          for (let i = 0; i < pdfBytes.byteLength; i++) {
            binary += String.fromCharCode(pdfBytes[i])
          }
          attachmentContent = btoa(binary)
          attachmentName = `Invoice-${invoice.invoice_number}.pdf`
          attachmentType = 'pdf'
          console.log('PDF generated successfully, size:', attachmentContent.length)
        } else {
          const errorText = await pdfResponse.text()
          console.error('PDFShift error:', pdfResponse.status, errorText)
          throw new Error('PDF generation failed')
        }
      } catch (pdfError) {
        console.error('PDF generation error, falling back to HTML:', pdfError)
        // Fallback to HTML
        attachmentContent = btoa(unescape(encodeURIComponent(professionalHtml)))
        attachmentName = `Invoice-${invoice.invoice_number}.html`
      }
    } else {
      console.log('PDFSHIFT_API_KEY not configured, using HTML attachment')
      attachmentContent = btoa(unescape(encodeURIComponent(professionalHtml)))
      attachmentName = `Invoice-${invoice.invoice_number}.html`
    }
    console.log(`Attachment prepared: ${attachmentName}, type: ${attachmentType}`)

    // Build enhanced email HTML with branded header and clean footer
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Branded Header - Logo + Business Name Only -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); padding: 24px 32px;">
          <tr>
            <td style="text-align: center;">
              ${issuerLogoUrl ? `
              <img src="${issuerLogoUrl}" alt="${businessName}" style="height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 12px;" />
              <br>
              ` : ''}
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${businessName}</span>
            </td>
          </tr>
        </table>

        <!-- Main Content -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">Dear ${clientName},</p>
              
              ${body.custom_message ? `<p style="margin: 0 0 16px; color: #374151; font-size: 16px;">${body.custom_message}</p>` : ''}
              
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                Please find below the details for invoice <strong>${invoice.invoice_number}</strong>.
              </p>

              ${invoiceSummary ? `<p style="margin: 0 0 24px; color: #6b7280; font-style: italic; font-size: 15px; padding-left: 16px; border-left: 3px solid #e5e7eb;">${invoiceSummary}</p>` : ''}

              <!-- Invoice Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Invoice Number:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <strong style="color: #1f2937; font-size: 14px;">${invoice.invoice_number}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Issue Date:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.issue_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Due Date:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.due_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0; border-top: 1px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 16px;">Total Amount:</strong>
                        </td>
                        <td style="text-align: right; padding: 12px 0 0; border-top: 1px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 18px;">${formatCurrency(invoice.total_amount, invoice.currency)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${verificationUrl ? `
              <!-- Verification Section with QR Code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">
                            🔒 Verify Invoice Authenticity
                          </p>
                          <p style="margin: 0 0 12px; color: #374151; font-size: 14px;">
                            Scan the QR code or click the button to verify this invoice is genuine.
                          </p>
                          <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                            Verify Invoice
                          </a>
                          <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">
                            Verification ID: ${invoice.verification_id}
                          </p>
                        </td>
                        ${qrCodeUrl ? `
                        <td style="width: 120px; text-align: right; vertical-align: top;">
                          <img src="${qrCodeUrl}" alt="QR Code" style="width: 100px; height: 100px; border-radius: 4px;" />
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 10px; text-align: center;">Scan to verify</p>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Invoice Attachment Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #166534; font-size: 14px;">
                      📎 <strong>Invoice Attached:</strong> Please find your professional invoice ${attachmentType === 'pdf' ? 'PDF' : 'document'} attached to this email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #374151; font-size: 16px;">
                If you have any questions, please don't hesitate to contact us.
              </p>
              
              <p style="margin: 16px 0 0; color: #374151; font-size: 16px;">
                Best regards,<br>
                <strong>${businessName}</strong>
              </p>
            </td>
          </tr>
        </table>

        <!-- Business Contact Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">${businessName}</p>
              ${issuerPhone ? `<p style="margin: 8px 0 0; font-size: 14px; color: #374151;">📞 ${issuerPhone}</p>` : ''}
              ${issuerEmail ? `<p style="margin: 4px 0 0; font-size: 14px; color: #374151;">✉️ ${issuerEmail}</p>` : ''}
              ${issuerAddress ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">📍 ${issuerAddress}</p>` : ''}
            </td>
          </tr>
        </table>

        <!-- Platform Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 16px 32px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.7);">
                Powered by Invoicemonk • © ${new Date().getFullYear()} Invoicemonk LTD
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`

    // Send email via Brevo API with HTML attachment
    console.log('Sending email via Brevo API to:', body.recipient_email)

    try {
      const brevoPayload: Record<string, unknown> = {
        sender: {
          name: businessName,
          email: smtpFrom,
        },
        to: [
          {
            email: body.recipient_email,
            name: clientName,
          },
        ],
        subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
        htmlContent: emailHtml,
        attachment: [
          {
            content: attachmentContent,
            name: attachmentName,
          },
        ],
      }

      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(brevoPayload),
      })

      if (!brevoResponse.ok) {
        const errorData = await brevoResponse.json()
        console.error('Brevo API error:', errorData)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to send email: ${errorData.message || 'Brevo API error'}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const brevoResult = await brevoResponse.json()
      console.log('Email sent successfully via Brevo:', brevoResult)
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice status to 'sent' if currently 'issued'
    if (invoice.status === 'issued') {
      await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', body.invoice_id)
    }

    // Log audit event and create notification using service role
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      
      // Log audit event
      await adminClient.rpc('log_audit_event', {
        _event_type: 'INVOICE_SENT',
        _entity_type: 'invoice',
        _entity_id: body.invoice_id,
        _user_id: userId,
        _business_id: invoice.business_id,
        _metadata: {
          recipient_email: body.recipient_email,
          sent_at: new Date().toISOString(),
          verification_url: verificationUrl,
          attachment_type: attachmentType,
          watermark_shown: showWatermark,
          branding_used: canUseBranding
        }
      })

      // Create INVOICE_SENT notification
      await adminClient.from('notifications').insert({
        user_id: userId,
        business_id: invoice.business_id,
        type: 'INVOICE_SENT',
        title: 'Invoice Sent',
        message: `Invoice ${invoice.invoice_number} was sent to ${body.recipient_email}`,
        entity_type: 'invoice',
        entity_id: invoice.id,
        is_read: false,
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invoice sent successfully with ${attachmentType.toUpperCase()} attachment`,
        recipient: body.recipient_email,
        attachment_type: attachmentType
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send invoice error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
