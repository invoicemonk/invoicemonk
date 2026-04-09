import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { initSentry, captureException } from '../_shared/sentry.ts'
import {
  validateUUIDStr as validateUUID,
  getCorsHeaders,
  checkRateLimit,
  rateLimitResponse,
  getRateLimitKeyFromRequest,
} from '../_shared/validation.ts'

initSentry()

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, true) // public endpoint

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Rate limit: 5 requests/minute per IP
    const rateLimitKey = getRateLimitKeyFromRequest(req)
    const allowed = await checkRateLimit(serviceKey, rateLimitKey, 'create-payment-session', 60, 5)
    if (!allowed) {
      return rateLimitResponse(corsHeaders)
    }

    // Parse request — only accept verification_id
    const { verification_id } = await req.json()

    const verificationError = validateUUID(verification_id, 'verification_id')
    if (verificationError) {
      return new Response(JSON.stringify({ error: verificationError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up invoice by verification_id (server-side, never trust client amounts)
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, business_id, invoice_number, total_amount, amount_paid, currency, status, verification_id, recipient_snapshot, user_id')
      .eq('verification_id', verification_id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate invoice can accept payments
    if (invoice.status === 'draft') {
      return new Response(JSON.stringify({ error: 'Invoice has not been issued yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (invoice.status === 'voided') {
      return new Response(JSON.stringify({ error: 'Invoice has been voided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (invoice.status === 'paid') {
      return new Response(JSON.stringify({ error: 'Invoice is already fully paid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Compute balance server-side
    const balance = invoice.total_amount - (invoice.amount_paid || 0)
    if (balance <= 0) {
      return new Response(JSON.stringify({ error: 'No balance remaining on this invoice' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check business is not flagged and has online payments enabled
    const { data: business } = await supabase
      .from('businesses')
      .select('id, jurisdiction, is_flagged, name, online_payments_enabled, stripe_connect_account_id, stripe_connect_status, paystack_subaccount_code, paystack_subaccount_status, verification_status')
      .eq('id', invoice.business_id)
      .maybeSingle()

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (business.is_flagged) {
      return new Response(JSON.stringify({ error: 'Payment is currently unavailable for this business' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Block payments for unverified businesses
    if (business.verification_status !== 'verified') {
      return new Response(JSON.stringify({ error: 'This business has not completed verification. Online payments are unavailable.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!business.online_payments_enabled) {
      return new Response(JSON.stringify({ error: 'Online payments are not enabled for this business' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Block payments if payout provider is not set up (CRITICAL: prevents money going to platform)
    const usePaystack = business.jurisdiction === 'NG' && invoice.currency === 'NGN'
    if (usePaystack) {
      if (!business.paystack_subaccount_code || business.paystack_subaccount_status !== 'active') {
        return new Response(JSON.stringify({ error: 'This business has not completed payment setup. Please contact the business directly.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      if (!business.stripe_connect_account_id || business.stripe_connect_status !== 'active') {
        return new Response(JSON.stringify({ error: 'This business has not completed payment setup. Please contact the business directly.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Self-payment detection: check if the payer is a member of the business
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      try {
        const payerToken = authHeader.replace('Bearer ', '')
        const { data: { user: payerUser } } = await supabase.auth.getUser(payerToken)
        if (payerUser) {
          const { data: memberCheck } = await supabase
            .from('business_members')
            .select('id')
            .eq('business_id', invoice.business_id)
            .eq('user_id', payerUser.id)
            .maybeSingle()

          if (memberCheck) {
            // Log fraud flag
            await supabase.from('fraud_flags').insert({
              business_id: invoice.business_id,
              invoice_id: invoice.id,
              user_id: payerUser.id,
              reason: 'SELF_PAYMENT_ATTEMPT',
              severity: 'critical',
              metadata: { invoice_number: invoice.invoice_number, payer_email: payerUser.email },
            })

            // Audit log
            try {
              await supabase.rpc('log_audit_event', {
                _event_type: 'SELF_PAYMENT_BLOCKED',
                _entity_type: 'online_payment',
                _entity_id: invoice.id,
                _user_id: payerUser.id,
                _business_id: invoice.business_id,
                _metadata: { invoice_number: invoice.invoice_number },
              })
            } catch (auditErr) {
              console.error('Audit log error:', auditErr)
            }

            return new Response(JSON.stringify({ error: 'You cannot pay your own invoice' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
      } catch (authErr) {
        // If token is invalid, skip self-payment check (anonymous payer)
        console.log('Could not verify payer identity, proceeding as anonymous')
      }
    }

    // Check subscription tier — free starter plan cannot use online payments
    const { data: bizSub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('business_id', invoice.business_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!bizSub || bizSub.tier === 'starter') {
      // Also check user-level subscription as fallback
      const { data: userSub } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', invoice.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!userSub || userSub.tier === 'starter') {
        return new Response(JSON.stringify({ error: 'Online payments require a paid plan' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Determine provider based on jurisdiction and currency (reuse usePaystack from line 118)
    const provider = usePaystack ? 'paystack' : 'stripe'

    const appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    const successUrl = `${appUrl}/invoice/view/${verification_id}?payment=success`
    const cancelUrl = `${appUrl}/invoice/view/${verification_id}?payment=cancelled`

    let checkoutUrl: string
    let providerSessionId: string
    let providerReference: string

    // Fetch platform fee config
    const { data: feeConfig } = await supabase
      .from('platform_fee_config')
      .select('fee_percent')
      .eq('provider', provider)
      .eq('is_active', true)
      .maybeSingle()

    const feePercent = (feeConfig?.fee_percent || 0) / 100 // Convert from percentage to decimal

    if (provider === 'paystack') {
      const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY')
      if (!paystackKey) {
        console.error('PAYSTACK_SECRET_KEY not configured')
        return new Response(JSON.stringify({ error: 'Payment provider not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Extract payer email from recipient_snapshot (required by Paystack)
      const recipientSnapshot = invoice.recipient_snapshot as Record<string, any> | null
      const payerEmail = recipientSnapshot?.email || recipientSnapshot?.client_email || null
      if (!payerEmail) {
        return new Response(JSON.stringify({ error: 'Client email is required for online payment. Please ask the business to update the recipient email on this invoice.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Paystack amounts are in kobo (smallest unit)
      const amountInKobo = Math.round(balance * 100)
      const reference = `inv_${invoice.id}_${Date.now()}`

      // Build Paystack init body
      const paystackBody: Record<string, any> = {
        email: payerEmail,
        amount: amountInKobo,
        currency: invoice.currency,
        reference,
        callback_url: successUrl,
        metadata: {
          invoice_id: invoice.id,
          business_id: invoice.business_id,
          verification_id,
          invoice_number: invoice.invoice_number,
          custom_fields: [
            { display_name: 'Invoice', variable_name: 'invoice_number', value: invoice.invoice_number },
          ],
        },
      }

      // If business has a Paystack subaccount, use split payment
      if (business.paystack_subaccount_code && business.paystack_subaccount_status === 'active') {
        paystackBody.subaccount = business.paystack_subaccount_code
        // transaction_charge is the flat amount in kobo that the platform keeps
        paystackBody.transaction_charge = Math.round(balance * 100 * feePercent)
        paystackBody.bearer = 'account' // subaccount bears Paystack's own fees
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paystackBody),
      })

      const paystackData = await paystackResponse.json()
      if (!paystackData.status || !paystackData.data?.authorization_url) {
        console.error('Paystack init failed:', { invoice_id: invoice.id, message: paystackData.message, code: paystackData.code })
        const userMessage = paystackData.message || 'Failed to initialize payment session'
        return new Response(JSON.stringify({ error: userMessage }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      checkoutUrl = paystackData.data.authorization_url
      providerSessionId = paystackData.data.access_code
      providerReference = reference
    } else {
      // Stripe
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeKey) {
        console.error('STRIPE_SECRET_KEY not configured')
        return new Response(JSON.stringify({ error: 'Payment provider not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

      // Build session options
      const sessionOptions: any = {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              unit_amount: Math.round(balance * 100),
              product_data: {
                name: `Invoice ${invoice.invoice_number}`,
                description: `Payment for invoice ${invoice.invoice_number} from ${business.name}`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: 'invoice_payment',
          invoice_id: invoice.id,
          business_id: invoice.business_id,
          verification_id,
          invoice_number: invoice.invoice_number,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      }

      // If business has an active Stripe Connect account, use destination charges
      if (business.stripe_connect_account_id && business.stripe_connect_status === 'active') {
        sessionOptions.payment_intent_data = {
          application_fee_amount: Math.round(balance * 100 * feePercent),
          transfer_data: {
            destination: business.stripe_connect_account_id,
          },
        }
      }

      const session = await stripe.checkout.sessions.create(sessionOptions)

      checkoutUrl = session.url!
      providerSessionId = session.id
      providerReference = session.id
    }

    // Insert online_payments record with status pending
    const { error: insertError } = await supabase
      .from('online_payments')
      .insert({
        invoice_id: invoice.id,
        business_id: invoice.business_id,
        provider,
        provider_reference: providerReference,
        provider_session_id: providerSessionId,
        amount: balance,
        currency: invoice.currency,
        status: 'pending',
      })

    if (insertError) {
      console.error('Failed to insert online_payment record:', insertError)
      // Don't fail — the checkout session was already created
    }

    // Audit log
    try {
      await supabase.rpc('log_audit_event', {
        _event_type: 'PAYMENT_SESSION_CREATED',
        _entity_type: 'online_payment',
        _entity_id: invoice.id,
        _business_id: invoice.business_id,
        _metadata: {
          provider,
          amount: balance,
          currency: invoice.currency,
          invoice_number: invoice.invoice_number,
        },
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
      captureException(auditErr, { function_name: 'create-payment-session' })
    }

    return new Response(
      JSON.stringify({ checkout_url: checkoutUrl, provider }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Create payment session error:', error)
    captureException(error, { function_name: 'create-payment-session' })
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
