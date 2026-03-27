import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


/**
 * Paystack Webhook Handler
 *
 * Security measures:
 * 1. HMAC SHA-512 signature verification
 * 2. Replay protection (5-minute window)
 * 3. Idempotency via UNIQUE provider_reference
 * 4. Currency mismatch validation
 * 5. Audit logging
 */

async function verifyPaystackSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedSignature = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return expectedSignature === signature
}

Deno.serve(async (req) => {
  // No CORS needed — server-to-server
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!paystackSecret) {
    console.error('PAYSTACK_SECRET_KEY not configured')
    return new Response('Not configured', { status: 500 })
  }

  const body = await req.text()

  // 1. Verify signature
  const signature = req.headers.get('x-paystack-signature')
  if (!signature) {
    console.error('Missing x-paystack-signature header')
    return new Response('Missing signature', { status: 400 })
  }

  const isValid = await verifyPaystackSignature(body, signature, paystackSecret)
  if (!isValid) {
    console.error('Invalid Paystack signature')
    return new Response('Invalid signature', { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // 2. Replay protection: reject events older than 5 minutes
  if (event.data?.paid_at) {
    const eventTime = new Date(event.data.paid_at).getTime()
    const now = Date.now()
    if (now - eventTime > 5 * 60 * 1000) {
      console.warn('Rejecting stale event:', event.data.reference, 'paid_at:', event.data.paid_at)
      return new Response(JSON.stringify({ received: true, skipped: 'stale_event' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  console.log('Paystack webhook event:', event.event)

  // Only handle charge.success
  if (event.event !== 'charge.success') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const data = event.data
  const reference = data.reference
  const amountPaid = data.amount / 100 // Paystack sends in kobo
  const currency = (data.currency || '').toUpperCase()

  // 3. Idempotency: check if this reference already processed
  const { data: existingPayment } = await supabase
    .from('online_payments')
    .select('id, status')
    .eq('provider_reference', reference)
    .maybeSingle()

  if (existingPayment?.status === 'completed') {
    console.log('Already processed reference:', reference)
    return new Response(JSON.stringify({ received: true, skipped: 'already_processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get invoice details from metadata or from online_payments record
  let invoiceId: string | null = data.metadata?.invoice_id || null
  let businessId: string | null = data.metadata?.business_id || null

  if (!invoiceId && existingPayment) {
    // Fallback: look up from the online_payments record
    const { data: opRecord } = await supabase
      .from('online_payments')
      .select('invoice_id, business_id')
      .eq('provider_reference', reference)
      .maybeSingle()
    invoiceId = opRecord?.invoice_id || null
    businessId = opRecord?.business_id || null
  }

  if (!invoiceId) {
    console.error('No invoice_id found for reference:', reference)
    return new Response(JSON.stringify({ received: true, error: 'no_invoice_id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch invoice
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select('id, business_id, total_amount, amount_paid, currency, status, user_id, invoice_number')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceErr || !invoice) {
    console.error('Invoice not found:', invoiceId, invoiceErr)
    return new Response(JSON.stringify({ received: true, error: 'invoice_not_found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 4. Currency mismatch check
  if (currency && currency !== invoice.currency) {
    console.error(`Currency mismatch: payment=${currency}, invoice=${invoice.currency}`)
    // Update online_payments to failed
    if (existingPayment) {
      await supabase
        .from('online_payments')
        .update({ status: 'failed', provider_metadata: data })
        .eq('id', existingPayment.id)
    }
    return new Response(JSON.stringify({ received: true, error: 'currency_mismatch' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Can't pay draft/voided invoices
  if (['draft', 'voided'].includes(invoice.status)) {
    console.warn('Invoice not payable, status:', invoice.status)
    return new Response(JSON.stringify({ received: true, skipped: 'invoice_not_payable' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Cap payment at remaining balance (prevent overpayment)
  const remainingBalance = invoice.total_amount - (invoice.amount_paid || 0)
  const effectiveAmount = Math.min(amountPaid, remainingBalance)

  if (effectiveAmount <= 0) {
    console.log('Invoice already fully paid:', invoiceId)
    if (existingPayment) {
      await supabase
        .from('online_payments')
        .update({ status: 'completed', completed_at: new Date().toISOString(), provider_metadata: data })
        .eq('id', existingPayment.id)
    }
    return new Response(JSON.stringify({ received: true, skipped: 'already_paid' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Update online_payments record
  if (existingPayment) {
    await supabase
      .from('online_payments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        provider_metadata: data,
      })
      .eq('id', existingPayment.id)
  } else {
    // Create record if it doesn't exist (e.g., session created outside our system)
    await supabase.from('online_payments').insert({
      invoice_id: invoice.id,
      business_id: invoice.business_id,
      provider: 'paystack',
      provider_reference: reference,
      provider_session_id: data.id?.toString(),
      amount: effectiveAmount,
      currency: invoice.currency,
      status: 'completed',
      completed_at: new Date().toISOString(),
      provider_metadata: data,
    })
  }

  // Record the payment (insert into payments table)
  const paymentDate = new Date().toISOString().split('T')[0]
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoice.id,
      amount: effectiveAmount,
      payment_method: 'paystack_online',
      payment_reference: `Paystack: ${reference}`,
      payment_date: paymentDate,
      notes: `Online payment via Paystack`,
      recorded_by: invoice.user_id,
    })
    .select('id')
    .single()

  if (paymentError) {
    console.error('Failed to create payment record:', paymentError)
    return new Response(JSON.stringify({ received: true, error: 'payment_insert_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Update invoice amount_paid and status
  const newAmountPaid = (invoice.amount_paid || 0) + effectiveAmount
  const isFullyPaid = newAmountPaid >= invoice.total_amount
  const newStatus = isFullyPaid ? 'paid' : invoice.status

  await supabase
    .from('invoices')
    .update({ amount_paid: newAmountPaid, status: newStatus })
    .eq('id', invoice.id)

  // Create receipt
  try {
    await supabase.rpc('create_receipt_from_payment', { _payment_id: payment.id })
  } catch (receiptErr) {
    console.error('Receipt creation failed:', receiptErr)
    captureException(receiptErr, { function_name: 'paystack-webhook' })
  }

  // Create notification
  try {
    let formattedAmount: string
    try {
      formattedAmount = new Intl.NumberFormat('en', { style: 'currency', currency: invoice.currency }).format(effectiveAmount)
    } catch {
      formattedAmount = `${invoice.currency} ${effectiveAmount.toLocaleString()}`
    }

    await supabase.from('notifications').insert({
      user_id: invoice.user_id,
      business_id: invoice.business_id,
      type: 'ONLINE_PAYMENT_RECEIVED',
      title: 'Online Payment Received',
      message: `Payment of ${formattedAmount} received via Paystack for invoice ${invoice.invoice_number}. ${isFullyPaid ? 'Invoice is now fully paid!' : ''}`,
      entity_type: 'invoice',
      entity_id: invoice.id,
    })
  } catch (notifErr) {
    console.error('Notification error:', notifErr)
    captureException(notifErr, { function_name: 'paystack-webhook' })
  }

  // 5. Audit log
  try {
    await supabase.rpc('log_audit_event', {
      _event_type: 'PAYMENT_RECORDED',
      _entity_type: 'payment',
      _entity_id: payment.id,
      _user_id: invoice.user_id,
      _business_id: invoice.business_id,
      _new_state: { status: newStatus, amount_paid: newAmountPaid, payment_amount: effectiveAmount },
      _metadata: {
        provider: 'paystack',
        provider_reference: reference,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        fully_paid: isFullyPaid,
        online_payment: true,
      },
    })
  } catch (auditErr) {
    console.error('Audit log error:', auditErr)
    captureException(auditErr, { function_name: 'paystack-webhook' })
  }

  console.log(`Payment processed: ${effectiveAmount} ${invoice.currency} for invoice ${invoice.invoice_number} (ref: ${reference})`)

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
