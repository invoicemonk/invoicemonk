import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendInvoiceRequest {
  invoice_id: string
  recipient_email: string
  custom_message?: string
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

// Helper: Format currency
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
    year: 'numeric', month: 'long', day: 'numeric' 
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

// Helper: Generate print-ready HTML for PDF (will be converted via html2pdf service)
const generatePrintableHtml = (
  invoice: Record<string, unknown>,
  items: InvoiceItem[],
  issuerSnapshot: IssuerSnapshot | null,
  recipientSnapshot: RecipientSnapshot | null,
  verificationUrl: string | null
): string => {
  const businessName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk'
  const clientName = recipientSnapshot?.name || 'Client'
  const clientAddress = formatAddressCompact(recipientSnapshot?.address)
  const clientEmail = recipientSnapshot?.email || ''
  const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
  const issuerEmail = issuerSnapshot?.contact_email || ''
  const issuerPhone = issuerSnapshot?.contact_phone || ''
  const currency = invoice.currency as string
  const balanceDue = (invoice.total_amount as number) - ((invoice.amount_paid as number) || 0)
  const summary = invoice.summary as string | null

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.unit_price, currency)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.amount, currency)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px; }
    .brand { font-size: 18px; font-weight: bold; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 24px; font-weight: bold; }
    .status { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-top: 5px; }
    .parties { display: flex; gap: 30px; margin-bottom: 20px; }
    .party { flex: 1; }
    .party-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
    .party-name { font-size: 14px; font-weight: bold; }
    .summary-box { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
    .summary-row.total { font-size: 14px; font-weight: bold; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f8f9fa; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; }
    th.right { text-align: right; }
    .totals { width: 250px; margin-left: auto; margin-top: 10px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .total-row.grand { font-size: 14px; font-weight: bold; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 5px; }
    .balance-box { background: #fef3c7; padding: 6px 10px; border-radius: 4px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #888; display: flex; justify-content: space-between; }
    .notes { background: #fafafa; padding: 10px; border-radius: 4px; margin-top: 15px; }
    .notes-label { font-size: 9px; color: #666; text-transform: uppercase; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${businessName}</div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${issuerAddress}</div>
      <div style="font-size: 10px; color: #666;">${issuerEmail}${issuerPhone ? ' • ' + issuerPhone : ''}</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div style="color: #666; margin-top: 3px;">${invoice.invoice_number}</div>
      <div class="status">${(invoice.status as string || 'ISSUED').toUpperCase()}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="party-name">${clientName}</div>
      ${clientAddress ? `<div style="font-size: 11px; color: #444; margin-top: 3px;">${clientAddress}</div>` : ''}
      ${clientEmail ? `<div style="font-size: 11px; color: #444;">${clientEmail}</div>` : ''}
    </div>
    <div class="party">
      <div class="summary-box">
        <div class="summary-row"><span>Invoice Date</span><span>${formatDate(invoice.issue_date as string)}</span></div>
        <div class="summary-row"><span>Due Date</span><span>${formatDate(invoice.due_date as string)}</span></div>
        <div class="summary-row"><span>Currency</span><span>${currency}</span></div>
        <div class="summary-row total"><span>Amount Due</span><span>${formatCurrency(balanceDue, currency)}</span></div>
      </div>
    </div>
  </div>

  ${summary ? `<div style="background: #f9fafb; padding: 10px; border-left: 3px solid #e5e7eb; margin-bottom: 15px; font-style: italic; color: #666;">${summary}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Unit Price</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${formatCurrency(invoice.subtotal as number, currency)}</span></div>
    ${(invoice.tax_amount as number) > 0 ? `<div class="total-row"><span>Tax</span><span>${formatCurrency(invoice.tax_amount as number, currency)}</span></div>` : ''}
    ${(invoice.discount_amount as number) > 0 ? `<div class="total-row"><span>Discount</span><span style="color: #059669;">-${formatCurrency(invoice.discount_amount as number, currency)}</span></div>` : ''}
    <div class="total-row grand"><span>Total</span><span>${formatCurrency(invoice.total_amount as number, currency)}</span></div>
    ${(invoice.amount_paid as number) > 0 ? `<div class="total-row" style="color: #059669;"><span>Paid</span><span>-${formatCurrency(invoice.amount_paid as number, currency)}</span></div>` : ''}
    <div class="total-row balance-box"><span>Balance Due</span><span>${formatCurrency(balanceDue, currency)}</span></div>
  </div>

  ${invoice.notes ? `<div class="notes"><div class="notes-label">Notes</div><div style="font-size: 10px; color: #444; margin-top: 4px;">${invoice.notes}</div></div>` : ''}

  <div class="footer">
    <div>
      <div>${businessName} • ${issuerAddress}</div>
      <div style="margin-top: 3px;">© ${new Date().getFullYear()} Invoicemonk LTD. All Rights Reserved.</div>
    </div>
    <div style="text-align: right;">
      ${invoice.verification_id ? `<div>Verification: ${(invoice.verification_id as string).substring(0, 8)}...</div>` : ''}
      ${invoice.invoice_hash ? `<div>Hash: ${(invoice.invoice_hash as string).substring(0, 12)}...</div>` : ''}
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

    // Parse snapshots for email content
    const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null
    const items = (invoice.invoice_items || []) as InvoiceItem[]
    
    const businessName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk'
    const clientName = recipientSnapshot?.name || invoice.clients?.name || 'Valued Customer'
    const invoiceSummary = invoice.summary as string | null

    // Format issuer address for header
    const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    const issuerLogoUrl = issuerSnapshot?.logo_url || null

    // Verification URL
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--af0fa778-97c6-4e74-8769-9640f7e7d956.lovable.app'
    const verificationUrl = invoice.verification_id 
      ? `${appUrl}/verify/invoice/${invoice.verification_id}`
      : null
    
    // Generate QR code for email
    const qrCodeUrl = verificationUrl 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=png`
      : null

    // Generate printable HTML for PDF
    const printableHtml = generatePrintableHtml(invoice, items, issuerSnapshot, recipientSnapshot, verificationUrl)
    
    // Attach the HTML as an HTML file (can be opened and printed as PDF by recipient)
    // This avoids the need for external PDF generation APIs
    console.log('Preparing invoice HTML attachment...')
    const htmlBase64 = btoa(unescape(encodeURIComponent(printableHtml)))
    console.log('HTML attachment prepared, size:', htmlBase64.length)

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
                      📎 <strong>Invoice Attached:</strong> Open the attached HTML file and use your browser's Print → Save as PDF option for a professional invoice copy.
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

    // Send email via Brevo API with PDF attachment
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
      }

      // Add HTML invoice attachment
      brevoPayload.attachment = [
        {
          content: htmlBase64,
          name: `Invoice-${invoice.invoice_number}.html`,
        },
      ]

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
          attachment_included: true
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
        message: 'Invoice sent successfully with attachment',
        recipient: body.recipient_email,
        attachment_included: true
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
