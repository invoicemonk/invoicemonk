import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { payment_id } = await req.json()
    if (!payment_id || typeof payment_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'payment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user has access to this payment's invoice (RLS will enforce)
    const { data: payment, error: paymentError } = await supabaseUser
      .from('payments')
      .select('id, invoice_id')
      .eq('id', payment_id)
      .maybeSingle()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if receipt already exists
    const { data: existingReceipt } = await supabaseService
      .from('receipts')
      .select('id, receipt_number, verification_id')
      .eq('payment_id', payment_id)
      .maybeSingle()

    if (existingReceipt) {
      return new Response(
        JSON.stringify({ receipt: existingReceipt }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate the receipt
    const { data: receiptId, error: rpcError } = await supabaseService
      .rpc('create_receipt_from_payment', { _payment_id: payment_id })

    if (rpcError || !receiptId) {
      console.error('Receipt generation failed:', rpcError)
      captureException(rpcError, { function_name: 'generate-receipt' })
      return new Response(
        JSON.stringify({ error: 'Failed to generate receipt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: receipt } = await supabaseService
      .from('receipts')
      .select('id, receipt_number, verification_id')
      .eq('id', receiptId)
      .single()

    return new Response(
      JSON.stringify({ receipt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('generate-receipt error:', error)
    captureException(error, { function_name: 'generate-receipt' })
    const corsHeaders = getCorsHeaders(req)
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
