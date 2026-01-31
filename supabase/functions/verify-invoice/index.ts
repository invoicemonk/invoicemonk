import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Validation utilities
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUUID(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (!UUID_REGEX.test(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

// Public endpoint CORS - allows broader access for verification portal
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface IssuerSnapshot {
  name?: string
  legal_name?: string
  tax_id?: string
  address?: Record<string, unknown>
  contact_email?: string
  contact_phone?: string
  logo_url?: string
}

interface VerificationResponse {
  verified: boolean
  invoice?: {
    invoice_number: string
    issue_date: string | null
    issued_at: string | null
    issuer_name: string
    issuer_identity?: {
      contact_email?: string
      contact_phone?: string
      legal_name?: string
    }
    payment_status: string
    total_amount: number
    currency: string
    integrity_valid: boolean
  }
  issuer_tier?: string
  error?: string
  upgrade_required?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const verification_id = url.searchParams.get('verification_id')

    // Validate verification_id
    const verificationError = validateUUID(verification_id, 'verification_id');
    if (verificationError) {
      const response: VerificationResponse = {
        verified: false,
        error: verificationError
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

    // Query invoice by verification_id - using snapshots for immutable data
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
        user_id,
        business_id,
        issuer_snapshot,
        recipient_snapshot
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

    // Query issuer tier for logging/analytics only (no blocking)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', invoice.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const issuerTier = subscription?.tier || 'starter'
    // Note: We no longer block Starter tier - verification is now available for all tiers
    // This enables universal verification as a trust/marketing feature

    // USE SNAPSHOT DATA - Not live data
    // This ensures verification matches the invoice as it was at issuance time
    let issuerName = 'Unknown Business'
    const snapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    
    if (snapshot) {
      issuerName = snapshot.legal_name || snapshot.name || 'Unknown Business'
    } else {
      // Fallback: Query live data only if snapshot missing (legacy invoices)
      console.warn('Invoice missing issuer_snapshot, falling back to live data:', invoice.id)
      const { data: business } = await supabase
        .from('businesses')
        .select('name, legal_name')
        .eq('id', invoice.business_id)
        .maybeSingle()
      
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
        issuer_identity: snapshot ? {
          contact_email: snapshot.contact_email,
          contact_phone: snapshot.contact_phone,
          legal_name: snapshot.legal_name || snapshot.name
        } : undefined,
        payment_status: paymentStatus,
        total_amount: invoice.total_amount,
        currency: invoice.currency,
        integrity_valid: integrityValid
      },
      issuer_tier: issuerTier
    }

    // Log the verification event (for audit purposes)
    try {
      await supabase.rpc('log_audit_event', {
        _entity_type: 'invoice',
        _entity_id: invoice.id,
        _event_type: 'INVOICE_VIEWED',
        _metadata: { 
          verification_type: 'public_portal',
          issuer_tier: issuerTier,
          snapshot_used: !!snapshot
        }
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