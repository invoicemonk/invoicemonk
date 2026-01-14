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
    // Watermark is required if:
    // 1. Template requires it (template_snapshot.watermark_required = true)
    // 2. User's tier doesn't allow removing watermarks
    const templateRequiresWatermark = templateSnapshot?.watermark_required !== false
    const showWatermark = templateRequiresWatermark && !canRemoveWatermark

    // Check branding permission
    // Branding is allowed if:
    // 1. Template supports branding (template_snapshot.supports_branding = true)
    // 2. User's tier allows branding
    const { data: brandingResult } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'custom_branding'
    })
    const brandingData = typeof brandingResult === 'object' && brandingResult !== null ? brandingResult : { allowed: false }
    const canUseBranding = brandingData.allowed === true && templateSnapshot?.supports_branding !== false

    // Format currency with proper locale based on currency
    const formatCurrency = (amount: number, currency: string = 'NGN') => {
      const localeMap: Record<string, string> = {
        'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
        'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
        'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
      }
      const locale = localeMap[currency] || 'en-US'
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
    }

    // Format date with proper handling
    const formatDate = (date: string | null | undefined) => {
      if (!date) return 'Not specified'
      try {
        return new Date(date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      } catch {
        return 'Not specified'
      }
    }

    // Format address with better structure
    const formatAddress = (address: Record<string, unknown> | null | undefined): string => {
      if (!address) return ''
      const parts = [
        address.line1 as string || address.street as string,
        address.line2 as string,
        address.city as string,
        address.state as string,
        address.postal_code as string || address.zip as string,
        address.country as string
      ].filter(Boolean)
      return parts.join(', ')
    }

    // Format address as HTML for multi-line display
    const formatAddressHtml = (address: Record<string, unknown> | null | undefined): string => {
      if (!address) return ''
      const lines = [
        address.line1 as string || address.street as string,
        address.line2 as string,
        [address.city as string, address.state as string, address.postal_code as string || address.zip as string].filter(Boolean).join(', '),
        address.country as string
      ].filter(Boolean)
      return lines.map(line => `<div>${line}</div>`).join('')
    }

    // Generate HTML for PDF (using snapshot data for issued invoices)
    const issuerName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk User'
    const issuerTaxId = issuerSnapshot?.tax_id || ''
    const issuerAddress = formatAddress(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    
    const recipientName = recipientSnapshot?.name || invoice.clients?.name || 'Client'
    const recipientEmail = recipientSnapshot?.email || invoice.clients?.email || ''
    const recipientTaxId = recipientSnapshot?.tax_id || invoice.clients?.tax_id || ''
    const recipientAddress = formatAddress(recipientSnapshot?.address || invoice.clients?.address as Record<string, unknown>)

    // Generate line items HTML
    const items = (invoice.invoice_items || []) as InvoiceItem[]
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price, invoice.currency)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.amount, invoice.currency)}</td>
      </tr>
    `).join('')

    // Verification URL
    const verificationUrl = invoice.verification_id 
      ? `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/verify/invoice/${invoice.verification_id}`
      : null

    // Generate watermark HTML if needed
    const watermarkHtml = showWatermark ? `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); 
                  font-size: 80px; color: rgba(0,0,0,0.05); font-weight: bold; z-index: -1; white-space: nowrap;">
        INVOICEMONK
      </div>
    ` : ''

    // Generate HTML document
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #1f2937; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 20px; font-weight: bold; color: #1f2937; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .status-issued { background: #dbeafe; color: #1d4ed8; }
    .status-paid { background: #d1fae5; color: #059669; }
    .status-voided { background: #fee2e2; color: #dc2626; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 40px; }
    .party { flex: 1; }
    .party-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
    .party-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .party-details { font-size: 14px; color: #4b5563; }
    .dates { display: flex; gap: 40px; margin-bottom: 40px; }
    .date-item { }
    .date-label { font-size: 12px; color: #6b7280; }
    .date-value { font-size: 14px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f9fafb; padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    th:last-child, td:last-child { text-align: right; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.grand { font-size: 18px; font-weight: bold; border-top: 2px solid #1f2937; padding-top: 12px; margin-top: 8px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .verification { background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 20px; }
    .verification-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .verification-id { font-family: monospace; font-size: 11px; color: #4b5563; word-break: break-all; }
    .immutable-notice { background: #dbeafe; border: 1px solid #93c5fd; padding: 12px 16px; border-radius: 8px; font-size: 12px; color: #1d4ed8; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
    .tax-info { font-size: 12px; color: #6b7280; margin-top: 8px; }
    .legal-snapshot { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin-top: 24px; font-size: 12px; }
    .legal-snapshot-label { font-weight: 600; color: #166534; margin-bottom: 8px; }
  </style>
</head>
<body>
  ${watermarkHtml}
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">${canUseBranding && issuerName ? issuerName : 'INVOICEMONK'}</div>
        ${!canUseBranding ? '<div style="font-size: 11px; color: #6b7280;">Powered by Invoicemonk</div>' : ''}
      </div>
      <div class="invoice-info">
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div class="status status-${invoice.status}">${invoice.status}</div>
      </div>
    </div>

    <div class="immutable-notice">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      This invoice is immutable. Issued on ${formatDate(invoice.issued_at)}.
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">From (Issuer)</div>
        <div class="party-name">${issuerName}</div>
        <div class="party-details">
          ${issuerTaxId ? `<div style="margin-top: 4px;"><strong>Tax ID:</strong> ${issuerTaxId}</div>` : ''}
          ${issuerSnapshot?.address ? `<div style="margin-top: 8px;">${formatAddressHtml(issuerSnapshot.address)}</div>` : ''}
          ${issuerEmail ? `<div style="margin-top: 8px;">📧 ${issuerEmail}</div>` : ''}
          ${issuerPhone ? `<div>📞 ${issuerPhone}</div>` : ''}
          ${issuerSnapshot?.jurisdiction ? `<div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">Jurisdiction: ${issuerSnapshot.jurisdiction}</div>` : ''}
        </div>
      </div>
      <div class="party">
        <div class="party-label">Bill To (Recipient)</div>
        <div class="party-name">${recipientName}</div>
        <div class="party-details">
          ${recipientTaxId ? `<div style="margin-top: 4px;"><strong>Tax ID:</strong> ${recipientTaxId}</div>` : ''}
          ${recipientSnapshot?.address || invoice.clients?.address ? `<div style="margin-top: 8px;">${formatAddressHtml(recipientSnapshot?.address || invoice.clients?.address as Record<string, unknown>)}</div>` : ''}
          ${recipientEmail ? `<div style="margin-top: 8px;">📧 ${recipientEmail}</div>` : ''}
          ${recipientSnapshot?.phone || invoice.clients?.phone ? `<div>📞 ${recipientSnapshot?.phone || invoice.clients?.phone}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="dates">
      <div class="date-item">
        <div class="date-label">Issue Date</div>
        <div class="date-value">${formatDate(invoice.issue_date)}</div>
      </div>
      <div class="date-item">
        <div class="date-label">Due Date</div>
        <div class="date-value">${formatDate(invoice.due_date)}</div>
      </div>
      <div class="date-item">
        <div class="date-label">Currency</div>
        <div class="date-value">${invoice.currency}</div>
      </div>
      ${invoice.tax_schema_version ? `
      <div class="date-item">
        <div class="date-label">Tax Schema</div>
        <div class="date-value">${invoice.tax_schema_version}</div>
      </div>
      ` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
      </div>
      <div class="total-row">
        <span>Tax</span>
        <span>${formatCurrency(invoice.tax_amount, invoice.currency)}</span>
      </div>
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
      <div class="total-row" style="color: #059669;">
        <span>Paid</span>
        <span>-${formatCurrency(invoice.amount_paid, invoice.currency)}</span>
      </div>
      <div class="total-row" style="font-weight: 600;">
        <span>Balance Due</span>
        <span>${formatCurrency(invoice.total_amount - invoice.amount_paid, invoice.currency)}</span>
      </div>
      ` : ''}
    </div>

    ${invoice.notes ? `
    <div style="margin-top: 24px;">
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Notes</div>
      <div style="font-size: 14px;">${invoice.notes}</div>
    </div>
    ` : ''}

    ${invoice.terms ? `
    <div style="margin-top: 16px;">
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Terms</div>
      <div style="font-size: 14px;">${invoice.terms}</div>
    </div>
    ` : ''}

    ${issuerSnapshot || recipientSnapshot ? `
    <div class="legal-snapshot">
      <div class="legal-snapshot-label">🔒 Legal Identity Record (Captured at Issuance)</div>
      <div style="color: #166534;">Business and client identity preserved for compliance. This record cannot be altered.</div>
    </div>
    ` : ''}

    ${verificationUrl ? `
    <div class="verification">
      <div class="verification-label">Verification</div>
      <div class="verification-id">ID: ${invoice.verification_id}</div>
      <div style="margin-top: 8px; font-size: 12px;">This invoice can be publicly verified at the verification portal.</div>
    </div>
    ` : ''}

    <div class="footer">
      <div>Invoice Hash: ${invoice.invoice_hash || 'N/A'}</div>
      <div style="margin-top: 8px;">Generated by Invoicemonk • ${new Date().toISOString()}</div>
      ${showWatermark ? '<div style="margin-top: 4px; color: #9ca3af;">Upgrade to Professional or Business tier to remove Invoicemonk branding.</div>' : ''}
    </div>
  </div>
</body>
</html>
    `

    // Log PDF generation event
    await supabase.rpc('log_audit_event', {
      _event_type: 'INVOICE_VIEWED',
      _entity_type: 'invoice',
      _entity_id: body.invoice_id,
      _user_id: userId,
      _metadata: { 
        action: 'pdf_download', 
        tier: userTier,
        watermark_shown: showWatermark,
        branding_used: canUseBranding
      }
    })

    // Return HTML (frontend will use browser print/PDF functionality)
    // For server-side PDF generation, we'd need a service like Puppeteer or wkhtmltopdf
    // For now, returning HTML that can be printed to PDF in browser
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
