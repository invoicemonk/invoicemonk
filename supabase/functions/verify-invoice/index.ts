import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateUUIDStr as validateUUID, corsHeaders, getRateLimitKeyFromRequest, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


interface IssuerSnapshot {
  business_name?: string
  name?: string // legacy fallback
  legal_name?: string
  tax_id?: string
  address?: Record<string, unknown>
  contact_email?: string
  contact_phone?: string
  logo_url?: string
  jurisdiction?: string
}

interface RelatedInvoiceLink {
  invoice_number: string
  verification_id: string | null
  status: string
  total_amount: number
  amount_paid: number
  currency: string
  deposit_percent?: number | null
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
      tax_id?: string
      jurisdiction?: string
    }
    issuer_identity_complete: boolean
    payment_status: string
    payment_method_type?: string
    total_amount: number
    currency: string
    integrity_valid: boolean
    kind?: string
    deposit_percent?: number | null
    parent_deposit?: RelatedInvoiceLink | null
    child_finals?: RelatedInvoiceLink[]
  }
  is_flagged?: boolean
  flag_reason?: string
  verification_status?: string | null
  verification_source?: string | null
  entity_type?: string | null
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
        business_id,
        issuer_snapshot,
        recipient_snapshot,
        payment_method_snapshot,
        kind,
        parent_invoice_id,
        deposit_percent
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

    // Check if business is flagged for fraud + get verification status
    let isFlagged = false
    let flagReason: string | null = null
    let verificationStatus: string | null = null
    let verificationSource: string | null = null
    let entityType: string | null = null
    if (invoice.business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('is_flagged, flag_reason, verification_status, verification_source, entity_type')
        .eq('id', invoice.business_id)
        .maybeSingle()
      if (business) {
        isFlagged = business.is_flagged || false
        flagReason = business.flag_reason || null
        verificationStatus = business.verification_status || null
        verificationSource = business.verification_source || null
        entityType = business.entity_type || null
      }
    }

    // USE SNAPSHOT DATA ONLY - no live data queries, no subscription lookups
    let issuerName = 'Unknown Business'
    const snapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    
    if (snapshot) {
      issuerName = snapshot.legal_name || snapshot.business_name || snapshot.name || 'Unknown Business'
    } else {
      // No fallback to live data - snapshot should always exist for issued invoices
      console.warn('Invoice missing issuer_snapshot:', invoice.id)
    }

    // Check issuer identity completeness (legal_name, tax_id, contact_email all present)
    const issuerIdentityComplete = !!(
      snapshot &&
      (snapshot.legal_name || snapshot.business_name || snapshot.name) &&
      snapshot.tax_id &&
      snapshot.contact_email
    )

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

    // Extract payment method type from snapshot (no sensitive details)
    const paymentMethodSnapshot = invoice.payment_method_snapshot as { provider_type?: string } | null
    const paymentMethodType = paymentMethodSnapshot?.provider_type || undefined

    // Fetch related deposit/final invoice linkage (lightweight, public-safe fields only)
    const invoiceKind = (invoice as { kind?: string }).kind || 'standard'
    const parentInvoiceId = (invoice as { parent_invoice_id?: string | null }).parent_invoice_id || null
    let parentDeposit: RelatedInvoiceLink | null = null
    let childFinals: RelatedInvoiceLink[] = []

    if (invoiceKind === 'final' && parentInvoiceId) {
      const { data: parent } = await supabase
        .from('invoices')
        .select('invoice_number, verification_id, status, total_amount, amount_paid, currency, deposit_percent')
        .eq('id', parentInvoiceId)
        .maybeSingle()
      if (parent) {
        parentDeposit = {
          invoice_number: parent.invoice_number,
          verification_id: parent.verification_id,
          status: parent.status,
          total_amount: Number(parent.total_amount),
          amount_paid: Number(parent.amount_paid || 0),
          currency: parent.currency,
          deposit_percent: parent.deposit_percent,
        }
      }
    } else if (invoiceKind === 'deposit') {
      const { data: children } = await supabase
        .from('invoices')
        .select('invoice_number, verification_id, status, total_amount, amount_paid, currency')
        .eq('parent_invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      childFinals = (children || []).map((c) => ({
        invoice_number: c.invoice_number,
        verification_id: c.verification_id,
        status: c.status,
        total_amount: Number(c.total_amount),
        amount_paid: Number(c.amount_paid || 0),
        currency: c.currency,
      }))
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
          legal_name: snapshot.legal_name || snapshot.business_name || snapshot.name,
          tax_id: snapshot.tax_id,
          jurisdiction: snapshot.jurisdiction
        } : undefined,
        issuer_identity_complete: issuerIdentityComplete,
        payment_status: paymentStatus,
        payment_method_type: paymentMethodType,
        total_amount: invoice.total_amount,
        currency: invoice.currency,
        integrity_valid: integrityValid,
        kind: invoiceKind,
        deposit_percent: (invoice as { deposit_percent?: number | null }).deposit_percent ?? null,
        parent_deposit: parentDeposit,
        child_finals: childFinals,
      },
      is_flagged: isFlagged,
      flag_reason: isFlagged ? (flagReason ?? undefined) : undefined,
      verification_status: verificationStatus,
      verification_source: verificationSource,
      entity_type: entityType,
    }

    // Fire-and-forget: Log to verification_access_logs (lightweight, auto-expiring)
    supabase
      .from('verification_access_logs')
      .insert({
        entity_type: 'invoice',
        entity_id: invoice.id,
        verification_id: verification_id,
        metadata: { snapshot_used: !!snapshot }
      })
      .then(({ error: logErr }) => {
        if (logErr) console.error('Verification access log error:', logErr)
      })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Verification error:', error)
    captureException(error, { function_name: 'verify-invoice' })
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
