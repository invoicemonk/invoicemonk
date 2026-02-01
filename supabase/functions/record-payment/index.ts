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

function validateAmount(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${fieldName} must be a valid number`;
  }
  if (value <= 0) {
    return `${fieldName} must be positive`;
  }
  if (value > 999999999.99) {
    return `${fieldName} exceeds maximum allowed value (999,999,999.99)`;
  }
  return null;
}

function validateString(value: unknown, fieldName: string, maxLength = 1000): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Optional field
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
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

interface RecordPaymentRequest {
  invoice_id: string
  amount: number
  payment_method?: string
  payment_reference?: string
  payment_date?: string
  notes?: string
}

interface RecordPaymentResponse {
  success: boolean
  payment?: {
    id: string
    invoice_id: string
    amount: number
    payment_date: string
  }
  invoice_status?: string
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
        JSON.stringify({ success: false, error: 'Unauthorized' } as RecordPaymentResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // User client for auth validation
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client for privileged operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as RecordPaymentResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Parse request body
    const body: RecordPaymentRequest = await req.json()
    
    // Validate invoice_id (UUID format)
    const invoiceIdError = validateUUID(body.invoice_id, 'invoice_id');
    if (invoiceIdError) {
      return new Response(
        JSON.stringify({ success: false, error: invoiceIdError } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate amount (positive number with max limit)
    const amountError = validateAmount(body.amount, 'amount');
    if (amountError) {
      return new Response(
        JSON.stringify({ success: false, error: amountError } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate optional string fields
    const paymentMethodError = validateString(body.payment_method, 'payment_method', 100);
    if (paymentMethodError) {
      return new Response(
        JSON.stringify({ success: false, error: paymentMethodError } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentRefError = validateString(body.payment_reference, 'payment_reference', 255);
    if (paymentRefError) {
      return new Response(
        JSON.stringify({ success: false, error: paymentRefError } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notesError = validateString(body.notes, 'notes', 1000);
    if (notesError) {
      return new Response(
        JSON.stringify({ success: false, error: notesError } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate payment_date format if provided
    if (body.payment_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.payment_date) || isNaN(new Date(body.payment_date).getTime())) {
        return new Response(
          JSON.stringify({ success: false, error: 'payment_date must be a valid date (YYYY-MM-DD)' } as RecordPaymentResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch the invoice to validate ownership and status
    const { data: invoice, error: invoiceError } = await supabaseUser
      .from('invoices')
      .select('id, status, total_amount, amount_paid, user_id, business_id')
      .eq('id', body.invoice_id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' } as RecordPaymentResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate invoice can accept payments
    const validPaymentStatuses = ['issued', 'sent', 'viewed']
    if (!validPaymentStatuses.includes(invoice.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot record payment for invoice with status: ${invoice.status}` 
        } as RecordPaymentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get previous state for audit log
    const previousState = {
      status: invoice.status,
      amount_paid: invoice.amount_paid
    }

    // Create payment record with sanitized inputs
    const { data: payment, error: paymentError } = await supabaseUser
      .from('payments')
      .insert({
        invoice_id: body.invoice_id,
        amount: body.amount,
        payment_method: body.payment_method ? sanitizeString(body.payment_method) : null,
        payment_reference: body.payment_reference ? sanitizeString(body.payment_reference) : null,
        payment_date: body.payment_date || new Date().toISOString().split('T')[0],
        notes: body.notes ? sanitizeString(body.notes) : null,
        recorded_by: userId
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Payment creation error:', paymentError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record payment' } as RecordPaymentResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate new amount paid
    const newAmountPaid = (invoice.amount_paid || 0) + body.amount
    const isFullyPaid = newAmountPaid >= invoice.total_amount
    const newStatus = isFullyPaid ? 'paid' : invoice.status

    // Update invoice amount_paid and potentially status
    const { error: updateError } = await supabaseUser
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus
      })
      .eq('id', body.invoice_id)

    if (updateError) {
      console.error('Invoice update error:', updateError)
      // Payment was recorded but invoice update failed - log but don't fail
    }

    // Log audit event using service client
    try {
      await supabaseService.rpc('log_audit_event', {
        _event_type: 'PAYMENT_RECORDED',
        _entity_type: 'payment',
        _entity_id: payment.id,
        _user_id: userId,
        _business_id: invoice.business_id,
        _previous_state: previousState,
        _new_state: { 
          status: newStatus, 
          amount_paid: newAmountPaid,
          payment_amount: body.amount 
        },
        _metadata: {
          invoice_id: body.invoice_id,
          payment_method: body.payment_method,
          fully_paid: isFullyPaid
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
    }

    // Create notification for payment received
    const formattedAmount = new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN' 
    }).format(body.amount)
    
    await createNotification(
      supabaseService,
      userId,
      'PAYMENT_RECEIVED',
      'Payment Received',
      `Payment of ${formattedAmount} has been recorded. ${isFullyPaid ? 'Invoice is now fully paid!' : ''}`,
      'invoice',
      body.invoice_id,
      invoice.business_id
    )

    const response: RecordPaymentResponse = {
      success: true,
      payment: {
        id: payment.id,
        invoice_id: payment.invoice_id,
        amount: payment.amount,
        payment_date: payment.payment_date
      },
      invoice_status: newStatus
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Record payment error:', error)
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while recording the payment' 
      } as RecordPaymentResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})