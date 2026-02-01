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

// Public endpoint CORS - allows broader access for public invoice viewing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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
    issuer_snapshot: IssuerSnapshot | null
    recipient_snapshot: RecipientSnapshot | null
    items: InvoiceItem[]
    verification_id: string
  }
  issuer_tier?: string
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
        verification_id,
        issuer_snapshot,
        recipient_snapshot,
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

    // Get issuer's subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', invoice.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const issuerTier = subscription?.tier || 'starter'

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
        issuer_snapshot: invoice.issuer_snapshot as IssuerSnapshot | null,
        recipient_snapshot: invoice.recipient_snapshot as RecipientSnapshot | null,
        items: sortedItems,
        verification_id: invoice.verification_id
      },
      issuer_tier: issuerTier
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('View invoice error:', error)
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