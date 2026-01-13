import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecordPaymentRequest {
  invoice_id: string
  amount: number
  payment_method?: string
  payment_reference?: string
  payment_date?: string
  notes?: string
}

interface RecordPaymentResponse {
  success: boolean
  payment?: {
    id: string
    invoice_id: string
    amount: number
    payment_date: string
  }
  invoice_status?: string
  error?: string
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
        JSON.stringify({ success: false, error: 'Unauthorized' } as RecordPaymentResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // User client for auth validation
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client for privileged operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as RecordPaymentResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Parse request body
    const body: RecordPaymentRequest = await req.json()
    
    if (!body.invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice ID is required' } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid payment amount is required' } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the invoice to validate ownership and status
    const { data: invoice, error: invoiceError } = await supabaseUser
      .from('invoices')
      .select('id, status, total_amount, amount_paid, user_id, business_id')
      .eq('id', body.invoice_id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' } as RecordPaymentResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate invoice can accept payments
    const validPaymentStatuses = ['issued', 'sent', 'viewed']
    if (!validPaymentStatuses.includes(invoice.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot record payment for invoice with status: ${invoice.status}` 
        } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get previous state for audit log
    const previousState = {
      status: invoice.status,
      amount_paid: invoice.amount_paid
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseUser
      .from('payments')
      .insert({
        invoice_id: body.invoice_id,
        amount: body.amount,
        payment_method: body.payment_method || null,
        payment_reference: body.payment_reference || null,
        payment_date: body.payment_date || new Date().toISOString().split('T')[0],
        notes: body.notes || null,
        recorded_by: userId
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Payment creation error:', paymentError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record payment' } as RecordPaymentResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate new amount paid
    const newAmountPaid = (invoice.amount_paid || 0) + body.amount
    const isFullyPaid = newAmountPaid >= invoice.total_amount
    const newStatus = isFullyPaid ? 'paid' : invoice.status

    // Update invoice amount_paid and potentially status
    const { error: updateError } = await supabaseUser
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus
      })
      .eq('id', body.invoice_id)

    if (updateError) {
      console.error('Invoice update error:', updateError)
      // Payment was recorded but invoice update failed - log but don't fail
    }

    // Log audit event using service client
    try {
      await supabaseService.rpc('log_audit_event', {
        _event_type: 'PAYMENT_RECORDED',
        _entity_type: 'payment',
        _entity_id: payment.id,
        _user_id: userId,
        _business_id: invoice.business_id,
        _previous_state: previousState,
        _new_state: { 
          status: newStatus, 
          amount_paid: newAmountPaid,
          payment_amount: body.amount 
        },
        _metadata: {
          invoice_id: body.invoice_id,
          payment_method: body.payment_method,
          fully_paid: isFullyPaid
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
    }

    const response: RecordPaymentResponse = {
      success: true,
      payment: {
        id: payment.id,
        invoice_id: payment.invoice_id,
        amount: payment.amount,
        payment_date: payment.payment_date
      },
      invoice_status: newStatus
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Record payment error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while recording the payment' 
      } as RecordPaymentResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
