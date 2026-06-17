import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

async function resolveBusinessId(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  metadataBusinessId?: string | null,
): Promise<string | null> {
  if (metadataBusinessId) return metadataBusinessId
  const { data } = await supabase
    .from('business_sensitive_data')
    .select('business_id')
    .eq('stripe_connect_account_id', accountId)
    .maybeSingle()
  return (data?.business_id as string | undefined) || null
}

function deriveAccountStatus(account: Stripe.Account): 'active' | 'pending' | 'restricted' {
  if (account.charges_enabled && account.payouts_enabled) return 'active'
  if (account.requirements?.currently_due?.length) return 'restricted'
  return 'pending'
}

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
    captureException(err, { function_name: 'stripe-connect-webhook' })
    return new Response('Invalid signature', { status: 400 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account
      const accountId = account.id
      const status = deriveAccountStatus(account)

      console.log('Connect account updated:', accountId, 'status:', status)

      const updatePayload: Record<string, unknown> = {
        stripe_connect_status: status,
      }

      if (status === 'active') {
        updatePayload.verification_status = 'verified'
        updatePayload.verification_source = 'stripe_kyc'
        updatePayload.verified_at = new Date().toISOString()
        updatePayload.verified_by = null
      }

      const resolvedBusinessId = await resolveBusinessId(supabase, accountId, account.metadata?.business_id)

      if (!resolvedBusinessId) {
        console.error('Could not resolve business_id for stripe account', accountId)
      } else {
        const { error } = await supabase
          .from('businesses')
          .update(updatePayload)
          .eq('id', resolvedBusinessId)
        if (error) console.error('Failed to update connect status:', error)

        try {
          await supabase.rpc('log_audit_event', {
            _event_type: status === 'active' ? 'BUSINESS_VERIFIED' : 'STRIPE_CONNECT_STATUS_UPDATED',
            _entity_type: 'business',
            _entity_id: resolvedBusinessId,
            _business_id: resolvedBusinessId,
            _metadata: { stripe_account_id: accountId, status, verification_source: status === 'active' ? 'stripe_kyc' : undefined },
          })
        } catch (e) {
          console.error('Audit log error:', e)
          captureException(e, { function_name: 'stripe-connect-webhook' })
        }
      }
    } else if (event.type === 'capability.updated') {
      const capability = event.data.object as Stripe.Capability
      const accountId = typeof capability.account === 'string' ? capability.account : capability.account.id

      console.log('Connect capability updated:', accountId, capability.id, 'status:', capability.status)

      // Re-fetch the account to get authoritative status
      let account: Stripe.Account | null = null
      try {
        account = await stripe.accounts.retrieve(accountId)
      } catch (e) {
        console.error('Failed to retrieve account for capability event:', e)
      }

      const resolvedBusinessId = await resolveBusinessId(
        supabase,
        accountId,
        account?.metadata?.business_id,
      )

      if (!resolvedBusinessId) {
        console.error('Could not resolve business_id for capability event', accountId)
      } else {
        let status: 'active' | 'pending' | 'restricted' = 'pending'
        if (account) {
          status = deriveAccountStatus(account)
        } else if (capability.status === 'inactive' || capability.status === 'unrequested') {
          status = 'restricted'
        }

        const { error } = await supabase
          .from('businesses')
          .update({ stripe_connect_status: status })
          .eq('id', resolvedBusinessId)
        if (error) console.error('Failed to update status from capability event:', error)

        try {
          await supabase.rpc('log_audit_event', {
            _event_type: 'STRIPE_CONNECT_CAPABILITY_UPDATED',
            _entity_type: 'business',
            _entity_id: resolvedBusinessId,
            _business_id: resolvedBusinessId,
            _metadata: {
              stripe_account_id: accountId,
              capability_id: capability.id,
              capability_status: capability.status,
              account_status: status,
            },
          })
        } catch (e) {
          console.error('Audit log error:', e)
          captureException(e, { function_name: 'stripe-connect-webhook' })
        }
      }
    } else if (event.type === 'person.updated') {
      const person = event.data.object as Stripe.Person
      const accountId = person.account

      console.log('Connect person updated:', accountId, person.id, 'verification:', person.verification?.status)

      let account: Stripe.Account | null = null
      try {
        account = await stripe.accounts.retrieve(accountId)
      } catch (e) {
        console.error('Failed to retrieve account for person event:', e)
      }

      const resolvedBusinessId = await resolveBusinessId(
        supabase,
        accountId,
        account?.metadata?.business_id,
      )

      if (!resolvedBusinessId) {
        console.error('Could not resolve business_id for person event', accountId)
      } else {
        const status: 'active' | 'pending' | 'restricted' = account
          ? deriveAccountStatus(account)
          : (person.verification?.status === 'unverified' ? 'restricted' : 'pending')

        const { error } = await supabase
          .from('businesses')
          .update({ stripe_connect_status: status })
          .eq('id', resolvedBusinessId)
        if (error) console.error('Failed to update status from person event:', error)

        try {
          await supabase.rpc('log_audit_event', {
            _event_type: 'STRIPE_CONNECT_PERSON_UPDATED',
            _entity_type: 'business',
            _entity_id: resolvedBusinessId,
            _business_id: resolvedBusinessId,
            _metadata: {
              stripe_account_id: accountId,
              person_id: person.id,
              verification_status: person.verification?.status,
              account_status: status,
            },
          })
        } catch (e) {
          console.error('Audit log error:', e)
          captureException(e, { function_name: 'stripe-connect-webhook' })
        }
      }
    } else {
      console.log('Unhandled connect event type:', event.type)
    }
  } catch (err) {
    console.error('Error processing connect webhook event:', err)
    captureException(err, { function_name: 'stripe-connect-webhook' })
    // Still return 200 so Stripe doesn't keep retrying on a code bug
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
