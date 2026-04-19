import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateUUIDStr as validateUUID, corsHeaders, getRateLimitKeyFromRequest, checkRateLimit, rateLimitResponse, stripUrls } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  tax_rate: number
  tax_amount: number
  discount_percent: number
  sort_order: number
}

interface IssuerSnapshot {
  name?: string
  legal_name?: string
  tax_id?: string
  cac_number?: string
  vat_registration_number?: string
  is_vat_registered?: boolean
  jurisdiction?: string
  address?: Record<string, string>
  contact_email?: string
  contact_phone?: string
  logo_url?: string
}

interface RecipientSnapshot {
  name?: string
  email?: string
  phone?: string
  tax_id?: string
  cac_number?: string
  address?: Record<string, string>
}

interface PaymentMethodSnapshot {
  provider_type: string
  display_name: string
  instructions: Record<string, string>
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

interface ViewInvoiceResponse {
  success: boolean
  invoice?: {
    invoice_number: string
    issue_date: string | null
    due_date: string | null
    status: string
    subtotal: number
    tax_amount: number
    discount_amount: number
    total_amount: number
    amount_paid: number
    currency: string
    notes: string | null
    terms: string | null
    summary: string | null
    issuer_snapshot: IssuerSnapshot | null
    recipient_snapshot: RecipientSnapshot | null
    payment_method_snapshot: PaymentMethodSnapshot | null
    items: InvoiceItem[]
    verification_id: string
    kind?: string
    deposit_percent?: number | null
    parent_deposit?: RelatedInvoiceLink | null
    child_finals?: RelatedInvoiceLink[]
  }
  issuer_tier?: string
  is_flagged?: boolean
  flag_reason?: string
  online_payments_enabled?: boolean
  connect_setup_incomplete?: boolean
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
      const response: ViewInvoiceResponse = {
        success: false,
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

    // Query invoice by verification_id with all details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        user_id,
        business_id,
        invoice_number,
        issue_date,
        due_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        currency,
        notes,
        terms,
        summary,
        verification_id,
        issuer_snapshot,
        recipient_snapshot,
        payment_method_snapshot,
        kind,
        parent_invoice_id,
        deposit_percent,
        invoice_items (
          id,
          description,
          quantity,
          unit_price,
          amount,
          tax_rate,
          tax_amount,
          discount_percent,
          sort_order
        )
      `)
      .eq('verification_id', verification_id)
      .maybeSingle()

    if (invoiceError) {
      console.error('Database error:', invoiceError)
      const response: ViewInvoiceResponse = {
        success: false,
        error: 'Unable to retrieve invoice at this time'
      }
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!invoice) {
      const response: ViewInvoiceResponse = {
        success: false,
        error: 'Invoice not found. This link may be invalid or expired.'
      }
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if invoice has been issued (only issued invoices can be viewed publicly)
    if (invoice.status === 'draft') {
      const response: ViewInvoiceResponse = {
        success: false,
        error: 'This invoice is still in draft status and has not been issued yet.'
      }
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sort items by sort_order
    const sortedItems = (invoice.invoice_items || []).sort(
      (a: InvoiceItem, b: InvoiceItem) => a.sort_order - b.sort_order
    )

    // Check if business is flagged for fraud
    let isFlagged = false
    let flagReason: string | null = null
    let onlinePaymentsEnabled = false

    // Get issuer's subscription tier first (needed for online payments check)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', invoice.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const issuerTier = subscription?.tier || 'starter'

    let connectSetupIncomplete = false

    if (invoice.business_id) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('is_flagged, flag_reason, online_payments_enabled, jurisdiction, stripe_connect_account_id, stripe_connect_status, paystack_subaccount_code, paystack_subaccount_status, verification_status')
        .eq('id', invoice.business_id)
        .maybeSingle()
      if (businessData) {
        isFlagged = businessData.is_flagged || false
        flagReason = businessData.flag_reason || null

        const businessVerified = businessData.verification_status === 'verified'

        // Determine provider
        const usePaystack = businessData.jurisdiction === 'NG' && invoice.currency === 'NGN'
        const providerReady = usePaystack
          ? (businessData.paystack_subaccount_code && businessData.paystack_subaccount_status === 'active')
          : (businessData.stripe_connect_account_id && businessData.stripe_connect_status === 'active')

        // Online payments only available for verified businesses on paid plans AND when provider is set up
        if (!isFlagged && businessVerified && (businessData.online_payments_enabled || false) && issuerTier !== 'starter') {
          if (providerReady) {
            onlinePaymentsEnabled = true
          } else {
            connectSetupIncomplete = true
          }
        }
      }
    }

    // Log the view event (for analytics)
    try {
      await supabase.rpc('log_audit_event', {
        _entity_type: 'invoice',
        _entity_id: invoice.id,
        _event_type: 'INVOICE_VIEWED',
        _metadata: { 
          view_type: 'public_view_page',
          verification_id: verification_id
        }
      })
    } catch (auditErr) {
      // Don't fail the request if audit logging fails
      console.error('Audit log error:', auditErr)
      captureException(auditErr, { function_name: 'view-invoice' })
    }

    // Update status to 'viewed' on first view (only from issued/sent)
    if (invoice.status === 'issued' || invoice.status === 'sent') {
      try {
        await supabase
          .from('invoices')
          .update({ status: 'viewed' })
          .eq('id', invoice.id)

        // Create notification for the invoice owner on first view
        const recipientName = (invoice.recipient_snapshot as RecipientSnapshot | null)?.name || 'A client'
        await supabase
          .from('notifications')
          .insert({
            user_id: invoice.user_id,
            business_id: invoice.business_id,
            type: 'INVOICE_VIEWED',
            title: 'Invoice Viewed',
            message: `${recipientName} viewed invoice ${invoice.invoice_number}`,
            entity_type: 'invoice',
            entity_id: invoice.id,
          })
      } catch (viewErr) {
        // Don't fail the request if status update or notification fails
        console.error('View status update error:', viewErr)
        captureException(viewErr, { function_name: 'view-invoice' })
      }
    }

    // Fetch deposit/final invoice linkage
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

    const response: ViewInvoiceResponse = {
      success: true,
      invoice: {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_amount: invoice.tax_amount,
        discount_amount: invoice.discount_amount,
        total_amount: invoice.total_amount,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        notes: invoice.notes,
        terms: invoice.terms,
        summary: invoice.summary ? stripUrls(String(invoice.summary)) : null,
        issuer_snapshot: invoice.issuer_snapshot as IssuerSnapshot | null,
        recipient_snapshot: invoice.recipient_snapshot as RecipientSnapshot | null,
        payment_method_snapshot: invoice.payment_method_snapshot as PaymentMethodSnapshot | null,
        items: sortedItems,
        verification_id: invoice.verification_id,
        kind: invoiceKind,
        deposit_percent: (invoice as { deposit_percent?: number | null }).deposit_percent ?? null,
        parent_deposit: parentDeposit,
        child_finals: childFinals,
      },
      issuer_tier: issuerTier,
      is_flagged: isFlagged,
      flag_reason: isFlagged ? (flagReason ?? undefined) : undefined,
      online_payments_enabled: onlinePaymentsEnabled,
      connect_setup_incomplete: connectSetupIncomplete
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('View invoice error:', error)
    captureException(error, { function_name: 'view-invoice' })
    const response: ViewInvoiceResponse = {
      success: false,
      error: 'An unexpected error occurred'
    }
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})