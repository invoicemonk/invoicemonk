import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IssueInvoiceRequest {
  invoice_id: string
}

interface IssueInvoiceResponse {
  success: boolean
  invoice?: {
    id: string
    invoice_number: string
    verification_id: string
    issued_at: string
    invoice_hash: string
  }
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
        JSON.stringify({ success: false, error: 'Unauthorized' } as IssueInvoiceResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as IssueInvoiceResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Check if user's email is verified (compliance requirement)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Profile lookup error:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to verify user status' } as IssueInvoiceResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile?.email_verified) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email verification required. Please verify your email before issuing invoices.' 
        } as IssueInvoiceResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: IssueInvoiceRequest = await req.json()
    
    if (!body.invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice ID is required' } as IssueInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call the database function to issue the invoice
    // This function handles: hash generation, verification_id, status update, and audit logging
    const { data: issuedInvoice, error: issueError } = await supabase
      .rpc('issue_invoice', { _invoice_id: body.invoice_id })

    if (issueError) {
      console.error('Issue invoice error:', issueError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: issueError.message || 'Failed to issue invoice' 
        } as IssueInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response: IssueInvoiceResponse = {
      success: true,
      invoice: {
        id: issuedInvoice.id,
        invoice_number: issuedInvoice.invoice_number,
        verification_id: issuedInvoice.verification_id,
        issued_at: issuedInvoice.issued_at,
        invoice_hash: issuedInvoice.invoice_hash
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Issue invoice error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while issuing the invoice' 
      } as IssueInvoiceResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
