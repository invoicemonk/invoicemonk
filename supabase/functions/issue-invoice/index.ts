import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Validation utilities (inline to avoid Deno import issues)
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
    
    // Validate invoice_id is a valid UUID
    const invoiceIdError = validateUUID(body.invoice_id, 'invoice_id');
    if (invoiceIdError) {
      return new Response(
        JSON.stringify({ success: false, error: invoiceIdError } as IssueInvoiceResponse),
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

    // Create notification for invoice issued
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)
    
    await createNotification(
      supabaseService,
      userId,
      'INVOICE_ISSUED',
      'Invoice Issued',
      `Invoice ${issuedInvoice.invoice_number} has been successfully issued.`,
      'invoice',
      issuedInvoice.id,
      issuedInvoice.business_id
    )

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
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while issuing the invoice' 
      } as IssueInvoiceResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})