import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { getCorsHeaders } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token)
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claims.claims.sub as string

    const { business_id } = await req.json()
    if (!business_id) {
      return new Response(JSON.stringify({ error: 'business_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user is owner/admin of this business
    const adminSupabase = createClient(supabaseUrl, serviceKey)

    const { data: member } = await adminSupabase
      .from('business_members')
      .select('role')
      .eq('business_id', business_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'You must be a business owner or admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if business already has a Connect account
    const { data: business } = await adminSupabase
      .from('businesses')
      .select('id, name, contact_email, stripe_connect_account_id, stripe_connect_status, verification_status')
      .eq('id', business_id)
      .maybeSingle()

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Block unverified or rejected businesses from connecting
    const vStatus = business.verification_status || 'unverified'
    if (vStatus === 'rejected') {
      return new Response(JSON.stringify({ error: 'Your business verification was rejected. Please contact support.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'

    let accountId = business.stripe_connect_account_id

    // If no account exists or status is not_started, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: business.contact_email || undefined,
        business_type: 'company',
        metadata: {
          business_id: business.id,
          platform: 'invoicemonk',
        },
      })

      accountId = account.id

      await adminSupabase
        .from('businesses')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: 'pending',
        })
        .eq('id', business_id)
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/b/${business_id}/settings?connect=refresh`,
      return_url: `${appUrl}/b/${business_id}/settings?connect=complete`,
      type: 'account_onboarding',
    })

    // Audit log
    try {
      await adminSupabase.rpc('log_audit_event', {
        _event_type: 'STRIPE_CONNECT_INITIATED',
        _entity_type: 'business',
        _entity_id: business_id,
        _user_id: userId,
        _business_id: business_id,
        _metadata: { stripe_account_id: accountId },
      })
    } catch (e) {
      console.error('Audit log error:', e)
      captureException(e, { function_name: 'create-connect-account' })
    }

    return new Response(
      JSON.stringify({ url: accountLink.url, account_id: accountId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Create connect account error:', error)
    captureException(error, { function_name: 'create-connect-account' })
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
