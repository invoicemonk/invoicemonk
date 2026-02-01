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

function validateString(value: unknown, fieldName: string, minLength = 0, maxLength = 1000): string | null {
  if (value === null || value === undefined || value === '') {
    if (minLength > 0) {
      return `${fieldName} is required`;
    }
    return null;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (value.trim().length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }
  return null;
}

function sanitizeString(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

// Dynamic CORS configuration - allows any Lovable preview domain + production
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com') ||
    origin === 'https://app.invoicemonk.com' ||
    origin === 'https://invoicemonk.com' ||
    origin.startsWith('http://localhost:')
  );
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://app.invoicemonk.com';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

// Helper function to create notification
async function createNotification(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  type: string,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
  businessId?: string | null
) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      business_id: businessId || null
    })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}

interface VoidInvoiceRequest {
  invoice_id: string
  reason: string
}

interface VoidInvoiceResponse {
  success: boolean
  credit_note?: {
    id: string
    credit_note_number: string
    amount: number
    reason: string
    issued_at: string
  }
  error?: string
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' } as VoidInvoiceResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as VoidInvoiceResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Parse request body
    const body: VoidInvoiceRequest = await req.json()
    
    // Validate invoice_id (UUID format)
    const invoiceIdError = validateUUID(body.invoice_id, 'invoice_id');
    if (invoiceIdError) {
      return new Response(
        JSON.stringify({ success: false, error: invoiceIdError } as VoidInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate reason (required, 10-500 chars)
    const reasonError = validateString(body.reason, 'reason', 10, 500);
    if (reasonError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: reasonError === 'reason is required' 
            ? 'A detailed reason (minimum 10 characters) is required to void an invoice'
            : reasonError
        } as VoidInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize reason
    const sanitizedReason = sanitizeString(body.reason);
    if (sanitizedReason.length < 10) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A detailed reason (minimum 10 characters) is required to void an invoice' 
        } as VoidInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the invoice to validate ownership and status
    const { data: invoice, error: invoiceError } = await supabaseUser
      .from('invoices')
      .select('id, invoice_number, status, total_amount, user_id, business_id')
      .eq('id', body.invoice_id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' } as VoidInvoiceResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate invoice can be voided (must be issued but not already voided/credited)
    const voidableStatuses = ['issued', 'sent', 'viewed']
    if (!voidableStatuses.includes(invoice.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot void invoice with status: ${invoice.status}. Only issued, sent, or viewed invoices can be voided.` 
        } as VoidInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get previous state for audit log
    const previousState = {
      status: invoice.status,
      invoice_number: invoice.invoice_number
    }

    // Generate credit note number
    const creditNoteNumber = `CN-${invoice.invoice_number}`

    // Generate verification ID and hash for credit note
    const verificationId = crypto.randomUUID()
    const hashInput = `${creditNoteNumber}${invoice.total_amount}${new Date().toISOString()}`
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput))
    const creditNoteHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Create credit note
    const { data: creditNote, error: creditNoteError } = await supabaseUser
      .from('credit_notes')
      .insert({
        original_invoice_id: body.invoice_id,
        credit_note_number: creditNoteNumber,
        amount: invoice.total_amount,
        reason: sanitizedReason,
        user_id: userId,
        business_id: invoice.business_id,
        issued_by: userId,
        verification_id: verificationId,
        credit_note_hash: creditNoteHash
      })
      .select()
      .single()

    if (creditNoteError) {
      console.error('Credit note creation error:', creditNoteError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create credit note' } as VoidInvoiceResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice status to voided
    const { error: updateError } = await supabaseUser
      .from('invoices')
      .update({
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: userId,
        void_reason: sanitizedReason
      })
      .eq('id', body.invoice_id)

    if (updateError) {
      console.error('Invoice void update error:', updateError)
      // Credit note was created but status update failed - this is a critical issue
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credit note created but failed to update invoice status. Please contact support.' 
        } as VoidInvoiceResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log audit event for the void action
    try {
      await supabaseService.rpc('log_audit_event', {
        _event_type: 'INVOICE_VOIDED',
        _entity_type: 'invoice',
        _entity_id: invoice.id,
        _user_id: userId,
        _business_id: invoice.business_id,
        _previous_state: previousState,
        _new_state: { 
          status: 'voided',
          void_reason: sanitizedReason,
          credit_note_id: creditNote.id
        },
        _metadata: {
          credit_note_number: creditNoteNumber,
          credit_note_amount: invoice.total_amount
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
    }

    // Create notification for invoice voided
    await createNotification(
      supabaseService,
      userId,
      'INVOICE_VOIDED',
      'Invoice Voided',
      `Invoice ${invoice.invoice_number} has been voided. Credit note ${creditNoteNumber} created.`,
      'invoice',
      invoice.id,
      invoice.business_id
    )

    const response: VoidInvoiceResponse = {
      success: true,
      credit_note: {
        id: creditNote.id,
        credit_note_number: creditNote.credit_note_number,
        amount: creditNote.amount,
        reason: creditNote.reason,
        issued_at: creditNote.issued_at
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Void invoice error:', error)
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while voiding the invoice' 
      } as VoidInvoiceResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})