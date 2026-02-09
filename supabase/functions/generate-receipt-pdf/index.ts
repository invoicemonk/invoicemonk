import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dynamic CORS configuration
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return (
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com') ||
    origin === 'https://app.invoicemonk.com' ||
    origin === 'https://invoicemonk.com' ||
    origin.startsWith('http://localhost:')
  )
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://app.invoicemonk.com'
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

interface GenerateReceiptPdfRequest {
  receipt_id: string
}

interface GenerateReceiptPdfResponse {
  success: boolean
  pdf?: string // base64 encoded
  filename?: string
  error?: string
}

// Format currency amount
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 2
  }).format(amount)
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

// Generate HTML for receipt PDF
function generateReceiptHtml(
  receipt: Record<string, unknown>,
  showWatermark: boolean,
  paymentMethodSnapshot?: Record<string, unknown> | null
): string {
  const issuer = receipt.issuer_snapshot as Record<string, unknown> || {}
  const payer = receipt.payer_snapshot as Record<string, unknown> || {}
  const invoice = receipt.invoice_snapshot as Record<string, unknown> || {}
  const payment = receipt.payment_snapshot as Record<string, unknown> || {}
  const issuerAddress = issuer.address as Record<string, string> || {}

  const formattedAmount = formatCurrency(receipt.amount as number, receipt.currency as string)
  const formattedDate = formatDate(receipt.issued_at as string)
  const paymentDate = formatDate(payment.payment_date as string || receipt.issued_at as string)

  const watermarkFooter = showWatermark 
    ? `<div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px;">
         Generated with Invoicemonk
       </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Helvetica Neue', Arial, sans-serif; 
          font-size: 14px; 
          line-height: 1.5; 
          color: #1f2937;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .receipt-title { 
          font-size: 28px; 
          font-weight: 700; 
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .receipt-number { 
          font-size: 16px; 
          color: #6b7280;
          margin-top: 8px;
        }
        .issuer-info { 
          text-align: right;
        }
        .issuer-name { 
          font-size: 18px; 
          font-weight: 600; 
          color: #111827;
        }
        .issuer-details { 
          color: #6b7280; 
          font-size: 13px;
          margin-top: 4px;
        }
        .section { 
          margin-bottom: 30px;
        }
        .section-title { 
          font-size: 12px; 
          font-weight: 600; 
          color: #9ca3af; 
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .amount-box {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          border-radius: 12px;
          text-align: center;
          margin: 30px 0;
        }
        .amount-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        }
        .amount-value {
          font-size: 36px;
          font-weight: 700;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .detail-label {
          color: #6b7280;
        }
        .detail-value {
          font-weight: 500;
          color: #111827;
        }
        .verification-section {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin-top: 30px;
        }
        .verification-title {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }
        .verification-hash {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #6b7280;
          word-break: break-all;
          background: white;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }
        .verification-id {
          font-size: 12px;
          color: #6b7280;
          margin-top: 10px;
        }
        .paid-stamp {
          display: inline-block;
          background: #dcfce7;
          color: #166534;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="receipt-title">Payment Receipt</div>
          <div class="receipt-number">${receipt.receipt_number}</div>
        </div>
        <div class="issuer-info">
          <div class="issuer-name">${issuer.legal_name || issuer.name || 'Business'}</div>
          <div class="issuer-details">
            ${issuer.contact_email || ''}<br>
            ${issuerAddress.street || ''} ${issuerAddress.city || ''}<br>
            ${issuer.tax_id ? `Tax ID: ${issuer.tax_id}` : ''}
          </div>
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Received</div>
        <div class="amount-value">${formattedAmount}</div>
      </div>

      <div class="details-grid">
        <div class="section">
          <div class="section-title">Received From</div>
          <div style="font-weight: 500; font-size: 16px; margin-bottom: 4px;">${payer.name || 'Customer'}</div>
          <div style="color: #6b7280; font-size: 13px;">
            ${payer.email || ''}<br>
            ${payer.tax_id ? `Tax ID: ${payer.tax_id}` : ''}
          </div>
        </div>
        <div class="section">
          <div class="section-title">Payment Details</div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${paymentDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Method</span>
            <span class="detail-value">${payment.payment_method || 'Not specified'}</span>
          </div>
          ${payment.payment_reference ? `
          <div class="detail-row">
            <span class="detail-label">Reference</span>
            <span class="detail-value">${payment.payment_reference}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Invoice Reference</div>
        <div class="detail-row">
          <span class="detail-label">Invoice Number</span>
          <span class="detail-value">${invoice.invoice_number || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Invoice Amount</span>
          <span class="detail-value">${formatCurrency(invoice.total_amount as number || 0, receipt.currency as string)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value"><span class="paid-stamp">Paid</span></span>
        </div>
      </div>

      ${(() => {
        if (!paymentMethodSnapshot) return ''
        const pmInstructions = paymentMethodSnapshot.instructions as Record<string, string> || {}
        const pmDisplayName = (paymentMethodSnapshot.display_name as string) || (paymentMethodSnapshot.provider_type as string) || 'Payment Method'
        const pmRows = Object.entries(pmInstructions)
          .filter(([, v]) => v)
          .map(([k, v]) => `
            <div class="detail-row">
              <span class="detail-label" style="text-transform: capitalize;">${String(k).replace(/_/g, ' ')}</span>
              <span class="detail-value" style="font-family: 'Courier New', monospace; font-size: 13px;">${String(v)}</span>
            </div>
          `).join('')
        return `
        <div class="section">
          <div class="section-title">Payment Method</div>
          <div style="font-weight: 500; font-size: 15px; margin-bottom: 8px;">${pmDisplayName}</div>
          ${pmRows}
        </div>`
      })()}

      <div class="verification-section">
        <div class="verification-title">Verification Information</div>
        <div class="verification-id">
          Verification ID: ${receipt.verification_id}
        </div>
        <div class="verification-hash">
          SHA-256: ${receipt.receipt_hash}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
          Verify this receipt at: invoicemonk.com/verify/receipt/${receipt.verification_id}
        </div>
      </div>

      ${watermarkFooter}
    </body>
    </html>
  `
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' } as GenerateReceiptPdfResponse),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' } as GenerateReceiptPdfResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY')

    // User client for auth validation
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client for privileged operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token)
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as GenerateReceiptPdfResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id

    // Parse request body
    const body: GenerateReceiptPdfRequest = await req.json()
    
    if (!body.receipt_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'receipt_id is required' } as GenerateReceiptPdfResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch receipt (RLS will enforce access)
    const { data: receipt, error: receiptError } = await supabaseUser
      .from('receipts')
      .select('*')
      .eq('id', body.receipt_id)
      .maybeSingle()

    if (receiptError || !receipt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Receipt not found or access denied' } as GenerateReceiptPdfResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch payment method snapshot from the related invoice
    let paymentMethodSnapshot: Record<string, unknown> | null = null
    if (receipt.invoice_id) {
      const { data: invoiceData } = await supabaseService
        .from('invoices')
        .select('payment_method_snapshot')
        .eq('id', receipt.invoice_id)
        .maybeSingle()
      paymentMethodSnapshot = invoiceData?.payment_method_snapshot as Record<string, unknown> | null
    }

    // Check user's subscription tier for watermark decision
    const { data: subscription } = await supabaseService
      .from('subscriptions')
      .select('tier')
      .eq('business_id', receipt.business_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const tier = subscription?.tier || 'starter'
    const showWatermark = tier === 'starter' || tier === 'starter_paid'

    // Generate HTML
    const html = generateReceiptHtml(receipt, showWatermark, paymentMethodSnapshot)

    // Generate PDF using PDFShift
    if (!pdfShiftApiKey) {
      // Fallback: return HTML if no PDF service configured
      console.warn('PDFSHIFT_API_KEY not configured, returning HTML')
      return new Response(
        JSON.stringify({ 
          success: true, 
          pdf: btoa(html),
          filename: `${receipt.receipt_number}.html`
        } as GenerateReceiptPdfResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call PDFShift API
    const pdfResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${pdfShiftApiKey}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: html,
        format: 'A4',
        margin: '20mm'
      })
    })

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text()
      console.error('PDFShift error:', errorText)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate PDF' } as GenerateReceiptPdfResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)))

    // Log RECEIPT_EXPORTED audit event
    try {
      await supabaseService.rpc('log_audit_event', {
        _event_type: 'RECEIPT_EXPORTED',
        _entity_type: 'receipt',
        _entity_id: receipt.id,
        _user_id: userId,
        _business_id: receipt.business_id,
        _previous_state: null,
        _new_state: null,
        _metadata: {
          format: 'pdf',
          watermark_applied: showWatermark,
          tier: tier
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
    }

    const response: GenerateReceiptPdfResponse = {
      success: true,
      pdf: pdfBase64,
      filename: `${receipt.receipt_number}.pdf`
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Generate receipt PDF error:', error)
    const corsHeaders = getCorsHeaders(req)
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' } as GenerateReceiptPdfResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
