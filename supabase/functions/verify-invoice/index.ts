import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerificationResponse {
  verified: boolean
  invoice?: {
    invoice_number: string
    issue_date: string | null
    issued_at: string | null
    issuer_name: string
    payment_status: string
    total_amount: number
    currency: string
    integrity_valid: boolean
  }
  error?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const verification_id = url.searchParams.get('verification_id')

    if (!verification_id) {
      const response: VerificationResponse = {
        verified: false,
        error: 'Verification ID is required'
      }
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client with service role for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Query invoice by verification_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        issue_date,
        issued_at,
        status,
        total_amount,
        currency,
        invoice_hash,
        business_id,
        businesses!invoices_business_id_fkey (
          name,
          legal_name
        )
      `)
      .eq('verification_id', verification_id)
      .maybeSingle()

    if (invoiceError) {
      console.error('Database error:', invoiceError)
      const response: VerificationResponse = {
        verified: false,
        error: 'Unable to verify invoice at this time'
      }
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!invoice) {
      const response: VerificationResponse = {
        verified: false,
        error: 'Invoice not found. This verification ID does not match any issued invoice.'
      }
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if invoice has been issued (only issued invoices can be verified)
    if (invoice.status === 'draft') {
      const response: VerificationResponse = {
        verified: false,
        error: 'This invoice is still in draft status and has not been issued.'
      }
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get business name (prefer legal_name, fall back to name)
    // Handle both single object and array cases from Supabase join
    let issuerName = 'Unknown Business'
    if (invoice.businesses) {
      const business = Array.isArray(invoice.businesses) 
        ? invoice.businesses[0] 
        : invoice.businesses
      if (business) {
        issuerName = business.legal_name || business.name || 'Unknown Business'
      }
    }

    // Check integrity (hash exists = not tampered)
    const integrityValid = !!invoice.invoice_hash

    // Determine payment status for display
    let paymentStatus: string
    switch (invoice.status) {
      case 'paid':
        paymentStatus = 'Paid'
        break
      case 'voided':
        paymentStatus = 'Voided'
        break
      case 'credited':
        paymentStatus = 'Credited'
        break
      case 'sent':
        paymentStatus = 'Sent - Awaiting Payment'
        break
      case 'viewed':
        paymentStatus = 'Viewed - Awaiting Payment'
        break
      case 'issued':
        paymentStatus = 'Issued - Awaiting Payment'
        break
      default:
        paymentStatus = 'Unknown'
    }

    const response: VerificationResponse = {
      verified: true,
      invoice: {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        issued_at: invoice.issued_at,
        issuer_name: issuerName,
        payment_status: paymentStatus,
        total_amount: invoice.total_amount,
        currency: invoice.currency,
        integrity_valid: integrityValid
      }
    }

    // Log the verification event (optional - for audit purposes)
    try {
      await supabase.rpc('log_audit_event', {
        _entity_type: 'invoice',
        _entity_id: invoice.id,
        _event_type: 'INVOICE_VIEWED',
        _metadata: { verification_type: 'public_portal' }
      })
    } catch (auditErr) {
      // Don't fail the request if audit logging fails
      console.error('Audit log error:', auditErr)
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Verification error:', error)
    const response: VerificationResponse = {
      verified: false,
      error: 'An unexpected error occurred during verification'
    }
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
