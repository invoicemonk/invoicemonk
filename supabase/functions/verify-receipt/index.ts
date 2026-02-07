import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface VerifyReceiptResponse {
  verified: boolean
  receipt?: {
    receipt_number: string
    amount: number
    currency: string
    issued_at: string
    issuer_name: string
    invoice_reference: string
    integrity_valid: boolean
    payer_name: string
    payment_method: string | null
    payment_date: string
  }
  error?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ verified: false, error: 'Method not allowed' } as VerifyReceiptResponse),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse verification_id from query params
    const url = new URL(req.url)
    const verificationId = url.searchParams.get('verification_id')

    if (!verificationId) {
      return new Response(
        JSON.stringify({ verified: false, error: 'verification_id is required' } as VerifyReceiptResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(verificationId)) {
      return new Response(
        JSON.stringify({ verified: false, error: 'Invalid verification_id format' } as VerifyReceiptResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Use service client - public endpoint, no auth required
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch receipt by verification_id
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('verification_id', verificationId)
      .maybeSingle()

    if (receiptError) {
      console.error('Receipt fetch error:', receiptError)
      return new Response(
        JSON.stringify({ verified: false, error: 'Failed to verify receipt' } as VerifyReceiptResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!receipt) {
      return new Response(
        JSON.stringify({ verified: false, error: 'Receipt not found' } as VerifyReceiptResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify hash integrity
    const hashInput = `${receipt.receipt_number}|${receipt.invoice_id}|${receipt.payment_id}|${receipt.amount}|${receipt.currency}|${receipt.issued_at}`
    
    // Use Web Crypto API for SHA-256
    const encoder = new TextEncoder()
    const data = encoder.encode(hashInput)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    const integrityValid = computedHash === receipt.receipt_hash

    // Log RECEIPT_VIEWED audit event (no user context for public endpoint)
    try {
      await supabase.rpc('log_audit_event', {
        _event_type: 'RECEIPT_VIEWED',
        _entity_type: 'receipt',
        _entity_id: receipt.id,
        _user_id: null,
        _business_id: receipt.business_id,
        _previous_state: null,
        _new_state: null,
        _metadata: {
          verification_id: verificationId,
          integrity_valid: integrityValid,
          source: 'public_verification'
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
      // Don't fail the request if audit logging fails
    }

    // Extract snapshot data only - never use live data
    const issuerSnapshot = receipt.issuer_snapshot as { name?: string; legal_name?: string }
    const payerSnapshot = receipt.payer_snapshot as { name?: string }
    const invoiceSnapshot = receipt.invoice_snapshot as { invoice_number?: string }
    const paymentSnapshot = receipt.payment_snapshot as { payment_method?: string; payment_date?: string }

    const response: VerifyReceiptResponse = {
      verified: true,
      receipt: {
        receipt_number: receipt.receipt_number,
        amount: receipt.amount,
        currency: receipt.currency,
        issued_at: receipt.issued_at,
        issuer_name: issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Unknown',
        invoice_reference: invoiceSnapshot?.invoice_number || 'Unknown',
        integrity_valid: integrityValid,
        payer_name: payerSnapshot?.name || 'Unknown',
        payment_method: paymentSnapshot?.payment_method || null,
        payment_date: paymentSnapshot?.payment_date || receipt.issued_at.split('T')[0]
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Verify receipt error:', error)
    return new Response(
      JSON.stringify({ verified: false, error: 'An unexpected error occurred' } as VerifyReceiptResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
