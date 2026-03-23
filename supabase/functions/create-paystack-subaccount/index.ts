import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/validation.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!paystackKey) {
      return new Response(JSON.stringify({ error: 'Paystack not configured' }), {
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

    const { business_id, bank_code, account_number, business_name } = await req.json()

    if (!business_id || !bank_code || !account_number) {
      return new Response(JSON.stringify({ error: 'business_id, bank_code, and account_number are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate account_number format (10 digits for Nigerian banks)
    if (!/^\d{10}$/.test(account_number)) {
      return new Response(JSON.stringify({ error: 'Account number must be 10 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user is owner/admin
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

    // Get business details
    const { data: business } = await adminSupabase
      .from('businesses')
      .select('id, name, paystack_subaccount_code')
      .eq('id', business_id)
      .maybeSingle()

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve account name first
    const resolveResponse = await fetch('https://api.paystack.co/bank/resolve?' + new URLSearchParams({
      account_number,
      bank_code,
    }), {
      headers: { Authorization: `Bearer ${paystackKey}` },
    })

    const resolveData = await resolveResponse.json()
    if (!resolveData.status) {
      return new Response(JSON.stringify({ error: 'Could not verify bank account. Please check your details.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accountName = resolveData.data.account_name

    // Get platform fee percentage for paystack
    const { data: feeConfig } = await adminSupabase
      .from('platform_fee_config')
      .select('fee_percent')
      .eq('provider', 'paystack')
      .eq('is_active', true)
      .maybeSingle()

    const feePercent = feeConfig?.fee_percent || 2.5

    // Create subaccount
    const createResponse = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_name: business_name || business.name,
        bank_code,
        account_number,
        percentage_charge: feePercent,
      }),
    })

    const createData = await createResponse.json()

    if (!createData.status || !createData.data?.subaccount_code) {
      console.error('Paystack subaccount creation failed:', createData)
      return new Response(JSON.stringify({ error: createData.message || 'Failed to create subaccount' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update business
    await adminSupabase
      .from('businesses')
      .update({
        paystack_subaccount_code: createData.data.subaccount_code,
        paystack_subaccount_status: 'active',
      })
      .eq('id', business_id)

    // Audit log
    try {
      await adminSupabase.rpc('log_audit_event', {
        _event_type: 'PAYSTACK_SUBACCOUNT_CREATED',
        _entity_type: 'business',
        _entity_id: business_id,
        _user_id: userId,
        _business_id: business_id,
        _metadata: {
          subaccount_code: createData.data.subaccount_code,
          account_name: accountName,
        },
      })
    } catch (e) {
      console.error('Audit log error:', e)
    }

    return new Response(
      JSON.stringify({
        subaccount_code: createData.data.subaccount_code,
        account_name: accountName,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Create paystack subaccount error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
