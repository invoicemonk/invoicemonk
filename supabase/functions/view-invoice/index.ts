import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      const response: ViewInvoiceResponse = {
        success: false,
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

    // Query invoice by verification_id with all details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
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
      }
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
