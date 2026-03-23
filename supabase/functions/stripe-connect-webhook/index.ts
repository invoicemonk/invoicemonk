import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')

  if (!stripeKey || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_CONNECT_WEBHOOK_SECRET')
    return new Response('Not configured', { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const accountId = account.id
    const businessId = account.metadata?.business_id

    console.log('Connect account updated:', accountId, 'charges_enabled:', account.charges_enabled)

    // Determine status
    let status = 'pending'
    if (account.charges_enabled && account.payouts_enabled) {
      status = 'active'
    } else if (account.requirements?.currently_due?.length) {
      status = 'restricted'
    }

    // Update by stripe_connect_account_id
    const { error } = await supabase
      .from('businesses')
      .update({ stripe_connect_status: status })
      .eq('stripe_connect_account_id', accountId)

    if (error) {
      console.error('Failed to update connect status:', error)
    }

    // Audit log
    if (businessId) {
      try {
        await supabase.rpc('log_audit_event', {
          _event_type: 'STRIPE_CONNECT_STATUS_UPDATED',
          _entity_type: 'business',
          _entity_id: businessId,
          _business_id: businessId,
          _metadata: { stripe_account_id: accountId, status },
        })
      } catch (e) {
        console.error('Audit log error:', e)
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
