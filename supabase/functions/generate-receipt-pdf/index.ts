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

// Currency symbol map
const currencySymbols: Record<string, string> = {
  NGN: '\u20A6', USD: '$', EUR: '\u20AC', GBP: '\u00A3', KES: 'KSh', GHS: 'GH\u20B5',
  ZAR: 'R', CAD: 'CA$', AUD: 'A$', JPY: '\u00A5', INR: '\u20B9', AED: 'AED',
}

// Format currency amount
function formatCurrency(amount: number, currency: string): string {
  const symbol = currencySymbols[currency] || currency + ' '
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${symbol}${formatted}`
}

// Format label keys
function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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

// Generate receipt PDF as base64 using pdfmake
async function generateReceiptPdfBase64(
  receipt: Record<string, unknown>,
  showWatermark: boolean,
  paymentMethodSnapshot?: Record<string, unknown> | null
): Promise<string> {
  // Dynamic imports for pdfmake
  // deno-lint-ignore no-explicit-any
  const pdfMakeModule: any = await import('https://esm.sh/pdfmake@0.2.13/build/pdfmake.js?bundle=false')
  // deno-lint-ignore no-explicit-any
  const pdfFontsModule: any = await import('https://esm.sh/pdfmake@0.2.13/build/vfs_fonts.js?bundle=false')
  const pdfMake = pdfMakeModule.default || pdfMakeModule
  const vfsData = pdfFontsModule?.pdfMake?.vfs || pdfFontsModule?.default?.pdfMake?.vfs
  if (vfsData) pdfMake.vfs = vfsData

  const issuer = receipt.issuer_snapshot as Record<string, unknown> || {}
  const payer = receipt.payer_snapshot as Record<string, unknown> || {}
  const invoice = receipt.invoice_snapshot as Record<string, unknown> || {}
  const payment = receipt.payment_snapshot as Record<string, unknown> || {}
  const issuerAddress = issuer.address as Record<string, string> || {}

  const formattedAmount = formatCurrency(receipt.amount as number, receipt.currency as string)
  const formattedDate = formatDate(receipt.issued_at as string)
  const paymentDate = formatDate(payment.payment_date as string || receipt.issued_at as string)

  // Build payment details rows
  // deno-lint-ignore no-explicit-any
  const paymentDetailsRows: any[] = [
    [{ text: 'Date', color: '#6b7280' }, { text: paymentDate, bold: true }],
    [{ text: 'Method', color: '#6b7280' }, { text: payment.payment_method || 'Not specified', bold: true }],
  ]
  if (payment.payment_reference) {
    paymentDetailsRows.push([
      { text: 'Reference', color: '#6b7280' },
      { text: payment.payment_reference, bold: true }
    ])
  }

  // Build payment method section if available
  // deno-lint-ignore no-explicit-any
  const paymentMethodSection: any[] = []
  if (paymentMethodSnapshot) {
    const pmInstructions = paymentMethodSnapshot.instructions as Record<string, string> || {}
    const pmDisplayName = (paymentMethodSnapshot.display_name as string) || (paymentMethodSnapshot.provider_type as string) || 'Payment Method'
    
    paymentMethodSection.push(
      { text: 'PAYMENT METHOD', style: 'sectionTitle', margin: [0, 16, 0, 6] },
      { text: pmDisplayName, fontSize: 13, bold: true, margin: [0, 0, 0, 6] }
    )

    const pmRows = Object.entries(pmInstructions)
      .filter(([, v]) => v)
      .map(([k, v]) => [
        { text: formatLabel(String(k)), color: '#6b7280' },
        { text: String(v), bold: true }
      ])
    
    if (pmRows.length > 0) {
      paymentMethodSection.push({
        table: {
          widths: ['auto', '*'],
          body: pmRows
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#f3f4f6',
          paddingTop: () => 4,
          paddingBottom: () => 4,
        }
      })
    }
  }

  // deno-lint-ignore no-explicit-any
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    ...(showWatermark ? { watermark: { text: 'Invoicemonk', color: '#e5e7eb', opacity: 0.15, bold: true } } : {}),
    content: [
      // Header
      {
        columns: [
          {
            stack: [
              { text: 'PAYMENT RECEIPT', fontSize: 20, bold: true, color: '#111827', letterSpacing: 2 },
              { text: receipt.receipt_number, fontSize: 12, color: '#6b7280', margin: [0, 4, 0, 0] },
            ]
          },
          {
            stack: [
              { text: issuer.legal_name || issuer.name || 'Business', fontSize: 14, bold: true, color: '#111827', alignment: 'right' },
              { text: issuer.contact_email || '', fontSize: 10, color: '#6b7280', alignment: 'right', margin: [0, 3, 0, 0] },
              { text: `${issuerAddress.street || ''} ${issuerAddress.city || ''}`.trim(), fontSize: 10, color: '#6b7280', alignment: 'right' },
              ...(issuer.tax_id ? [{ text: `Tax ID: ${issuer.tax_id}`, fontSize: 10, color: '#6b7280', alignment: 'right' }] : []),
            ]
          }
        ]
      },
      // Divider
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#e5e7eb' }], margin: [0, 14, 0, 14] },

      // Amount box
      {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'Amount Received', fontSize: 11, color: 'white', alignment: 'center', opacity: 0.9, margin: [0, 0, 0, 4] },
                { text: formattedAmount, fontSize: 24, bold: true, color: 'white', alignment: 'center' },
              ],
              fillColor: '#10b981',
              margin: [0, 14, 0, 14],
            }
          ]]
        },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 16, paddingRight: () => 16 },
        margin: [0, 6, 0, 16],
      },

      // Received From + Payment Details
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'RECEIVED FROM', style: 'sectionTitle' },
              { text: payer.name || 'Customer', fontSize: 14, bold: true, margin: [0, 4, 0, 2] },
              { text: payer.email || '', fontSize: 11, color: '#6b7280' },
              ...(payer.tax_id ? [{ text: `Tax ID: ${payer.tax_id}`, fontSize: 11, color: '#6b7280' }] : []),
            ]
          },
          {
            width: '50%',
            stack: [
              { text: 'PAYMENT DETAILS', style: 'sectionTitle' },
              {
                table: {
                  widths: ['auto', '*'],
                  body: paymentDetailsRows
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0,
                  hLineColor: () => '#f3f4f6',
                  paddingTop: () => 4,
                  paddingBottom: () => 4,
                },
                margin: [0, 4, 0, 0],
              }
            ]
          }
        ],
        columnGap: 20,
      },

      // Invoice Reference
      { text: 'INVOICE REFERENCE', style: 'sectionTitle', margin: [0, 18, 0, 6] },
      {
        table: {
          widths: ['auto', '*'],
          body: [
            [{ text: 'Invoice Number', color: '#6b7280' }, { text: invoice.invoice_number || 'N/A', bold: true }],
            [{ text: 'Invoice Amount', color: '#6b7280' }, { text: formatCurrency(invoice.total_amount as number || 0, receipt.currency as string), bold: true }],
            [{ text: 'Status', color: '#6b7280' }, { text: 'PAID', bold: true, color: '#166534', fontSize: 11 }],
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#f3f4f6',
          paddingTop: () => 4,
          paddingBottom: () => 4,
        }
      },

      // Payment Method section (if available)
      ...paymentMethodSection,

      // Verification section
      {
        stack: [
          { text: 'Verification Information', fontSize: 11, bold: true, color: '#374151', margin: [0, 0, 0, 6] },
          { text: `Verification ID: ${receipt.verification_id}`, fontSize: 10, color: '#6b7280', margin: [0, 0, 0, 4] },
          {
            table: {
              widths: ['*'],
              body: [[{ text: `SHA-256: ${receipt.receipt_hash}`, fontSize: 9, color: '#6b7280' }]]
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb',
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 4],
          },
          { text: `Verify this receipt at: invoicemonk.com/verify/receipt/${receipt.verification_id}`, fontSize: 10, color: '#6b7280', margin: [0, 4, 0, 0] },
        ],
        fillColor: '#f9fafb',
        margin: [0, 20, 0, 0],
        padding: [14, 14, 14, 14],
      },

      // Watermark footer
      ...(showWatermark ? [{
        text: 'Generated with Invoicemonk',
        fontSize: 9,
        color: '#9ca3af',
        alignment: 'center' as const,
        margin: [0, 20, 0, 0] as [number, number, number, number],
      }] : []),
    ],
    styles: {
      sectionTitle: {
        fontSize: 10,
        bold: true,
        color: '#9ca3af',
        letterSpacing: 1,
      }
    },
    defaultStyle: {
      fontSize: 11,
      color: '#1f2937',
    }
  }

  return new Promise<string>((resolve, reject) => {
    try {
      // deno-lint-ignore no-explicit-any
      const pdfDocGenerator = pdfMake.createPdf(docDefinition as any)
      pdfDocGenerator.getBase64((base64: string) => {
        resolve(base64)
      })
    } catch (err) {
      reject(err)
    }
  })
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' } as GenerateReceiptPdfResponse),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token)
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as GenerateReceiptPdfResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id
    const body: GenerateReceiptPdfRequest = await req.json()
    
    if (!body.receipt_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'receipt_id is required' } as GenerateReceiptPdfResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch receipt (RLS enforces access)
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

    // Fetch payment method snapshot from related invoice
    let paymentMethodSnapshot: Record<string, unknown> | null = null
    if (receipt.invoice_id) {
      const { data: invoiceData } = await supabaseService
        .from('invoices')
        .select('payment_method_snapshot')
        .eq('id', receipt.invoice_id)
        .maybeSingle()
      paymentMethodSnapshot = invoiceData?.payment_method_snapshot as Record<string, unknown> | null
    }

    // Check subscription tier for watermark
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

    // Generate PDF using pdfmake
    console.log('Generating receipt PDF using pdfmake...')
    const pdfBase64 = await generateReceiptPdfBase64(receipt, showWatermark, paymentMethodSnapshot)

    // Log audit event
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
