import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeneratePdfRequest {
  invoice_id: string
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

interface IssuerSnapshot {
  legal_name?: string
  name?: string
  tax_id?: string
  address?: Record<string, unknown>
  jurisdiction?: string
  contact_email?: string
  contact_phone?: string
  logo_url?: string
}

interface RecipientSnapshot {
  name?: string
  email?: string
  tax_id?: string
  address?: Record<string, unknown>
  phone?: string
}

interface TemplateSnapshot {
  id?: string
  name?: string
  watermark_required?: boolean
  supports_branding?: boolean
  tier_required?: string
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

    // Parse request body
    const body: GeneratePdfRequest = await req.json()
    
    if (!body.invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoice with all related data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        clients (*),
        invoice_items (*)
      `)
      .eq('id', body.invoice_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if invoice is issued (only issued invoices can be downloaded as PDF)
    if (invoice.status === 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot generate PDF for draft invoices. Please issue the invoice first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's subscription tier
    const { data: tierResult, error: tierError } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'remove_watermark'
    })

    if (tierError) {
      console.error('Tier check error:', tierError)
    }

    // Parse tier result
    const tierData = typeof tierResult === 'object' && tierResult !== null ? tierResult : { allowed: false, tier: 'starter' }
    const userTier = tierData.tier || 'starter'
    const canRemoveWatermark = tierData.allowed === true

    // Parse snapshots (use snapshots for issued invoices, not live data)
    const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null
    const templateSnapshot = invoice.template_snapshot as TemplateSnapshot | null

    // Determine if watermark should be applied
    const templateRequiresWatermark = templateSnapshot?.watermark_required !== false
    const showWatermark = templateRequiresWatermark && !canRemoveWatermark

    // Check branding permission
    const { data: brandingResult } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'custom_branding'
    })
    const brandingData = typeof brandingResult === 'object' && brandingResult !== null ? brandingResult : { allowed: false }
    const canUseBranding = brandingData.allowed === true && templateSnapshot?.supports_branding !== false

    // Format currency with proper locale based on currency - uses invoice currency, no fallback to NGN
    const formatCurrency = (amount: number, currency: string) => {
      const localeMap: Record<string, string> = {
        'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
        'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
        'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
      }
      const locale = localeMap[currency] || 'en-US'
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
    }

    // Format date compactly
    const formatDate = (date: string | null | undefined) => {
      if (!date) return '—'
      try {
        return new Date(date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      } catch {
        return '—'
      }
    }

    // Format address as compact single line
    const formatAddressCompact = (address: Record<string, unknown> | null | undefined): string => {
      if (!address) return ''
      const parts = [
        address.line1 as string || address.street as string,
        address.city as string,
        address.state as string,
        address.country as string
      ].filter(Boolean)
      return parts.join(', ')
    }

    // Get issuer and recipient data from snapshots
    const issuerName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk User'
    const issuerTaxId = issuerSnapshot?.tax_id || ''
    const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    
    const recipientName = recipientSnapshot?.name || invoice.clients?.name || 'Client'
    const recipientEmail = recipientSnapshot?.email || invoice.clients?.email || ''
    const recipientAddress = formatAddressCompact(recipientSnapshot?.address || invoice.clients?.address as Record<string, unknown>)

    // Generate compact line items HTML
    const items = (invoice.invoice_items || []) as InvoiceItem[]
    const itemsHtml = items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unit_price, invoice.currency)}</td>
        <td class="right">${formatCurrency(item.amount, invoice.currency)}</td>
      </tr>
    `).join('')

    // Status color mapping
    const statusColors: Record<string, { bg: string; color: string }> = {
      'issued': { bg: '#dbeafe', color: '#1d4ed8' },
      'sent': { bg: '#e0e7ff', color: '#4338ca' },
      'viewed': { bg: '#fef3c7', color: '#d97706' },
      'paid': { bg: '#d1fae5', color: '#059669' },
      'voided': { bg: '#fee2e2', color: '#dc2626' },
      'credited': { bg: '#fce7f3', color: '#db2777' }
    }
    const statusStyle = statusColors[invoice.status] || statusColors['issued']

    // Calculate balance due
    const balanceDue = invoice.total_amount - (invoice.amount_paid || 0)

    // Watermark HTML (subtle, doesn't take space)
    const watermarkHtml = showWatermark ? `
      <div class="watermark">INVOICEMONK</div>
    ` : ''

    // QR Code generation - SVG-based for better quality
    const appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    const verificationUrl = invoice.verification_id 
      ? `${appUrl}/verify/invoice/${invoice.verification_id}` 
      : null
    
    // Get business logo URL if branding is allowed
    const issuerLogoUrl = canUseBranding && issuerSnapshot?.logo_url ? issuerSnapshot.logo_url : null

    // Generate QR code data for SVG (simplified matrix representation)
    const generateQRCodeSVG = (data: string, size: number = 60): string => {
      // Use a simple URL-safe encoding and generate a placeholder QR pattern
      // For production, this would use a proper QR library
      const encoded = encodeURIComponent(data)
      // Use an external QR code service as inline SVG generation is complex
      return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=svg" alt="QR Code" style="width: ${size}px; height: ${size}px;" />`
    }

    const qrCodeHtml = verificationUrl ? generateQRCodeSVG(verificationUrl, 50) : ''

    // Compact footer line
    const verificationLine = invoice.verification_id 
      ? `Verification: ${invoice.verification_id.substring(0, 8)}...` 
      : ''
    const hashLine = invoice.invoice_hash 
      ? `Hash: ${invoice.invoice_hash.substring(0, 12)}...` 
      : ''

    // Generate compact HTML document
    const html = `<!DOCTYPE html>
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
          <div class="brand">${canUseBranding ? issuerName : 'INVOICEMONK'}</div>
          ${!canUseBranding ? '<div class="brand-sub">Powered by Invoicemonk</div>' : ''}
          ${canUseBranding && issuerAddress ? `<div class="brand-sub">${issuerAddress}</div>` : ''}
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div class="status" style="background: ${statusStyle.bg}; color: ${statusStyle.color};">${invoice.status.toUpperCase()}</div>
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
            <span>${formatDate(invoice.issue_date)}</span>
          </div>
          <div class="summary-row">
            <span>Due Date</span>
            <span>${formatDate(invoice.due_date)}</span>
          </div>
          <div class="summary-row">
            <span>Currency</span>
            <span>${invoice.currency}</span>
          </div>
          <div class="summary-row amount-due">
            <span>Amount Due</span>
            <span>${formatCurrency(balanceDue, invoice.currency)}</span>
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
          <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
        </div>
        ${invoice.tax_amount > 0 ? `
        <div class="total-row">
          <span>Tax</span>
          <span>${formatCurrency(invoice.tax_amount, invoice.currency)}</span>
        </div>
        ` : ''}
        ${invoice.discount_amount > 0 ? `
        <div class="total-row">
          <span>Discount</span>
          <span>-${formatCurrency(invoice.discount_amount, invoice.currency)}</span>
        </div>
        ` : ''}
        <div class="total-row grand">
          <span>Total</span>
          <span>${formatCurrency(invoice.total_amount, invoice.currency)}</span>
        </div>
        ${invoice.amount_paid > 0 ? `
        <div class="total-row paid">
          <span>Paid</span>
          <span>-${formatCurrency(invoice.amount_paid, invoice.currency)}</span>
        </div>
        <div class="total-row balance">
          <span>Balance Due</span>
          <span>${formatCurrency(balanceDue, invoice.currency)}</span>
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

    // Log PDF export event for compliance
    await supabase.rpc('log_audit_event', {
      _event_type: 'DATA_EXPORTED',
      _entity_type: 'invoice',
      _entity_id: body.invoice_id,
      _user_id: userId,
      _business_id: invoice.business_id,
      _metadata: { 
        export_type: 'pdf',
        invoice_number: invoice.invoice_number,
        tier: userTier,
        watermark_shown: showWatermark,
        branding_used: canUseBranding
      }
    })

    // Return HTML (frontend will use browser print/PDF functionality)
    return new Response(html, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'X-Invoice-Number': invoice.invoice_number,
        'X-Watermark-Applied': showWatermark.toString(),
        'X-User-Tier': userTier
      }
    })

  } catch (error) {
    console.error('Generate PDF error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while generating the PDF' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
