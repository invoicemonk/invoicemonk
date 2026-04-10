import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateUUIDStr as validateUUID, getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


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
    captureException(err, { function_name: 'issue-invoice' })
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

// Compute trust score based on business/user signals
async function computeTrustScore(
  // deno-lint-ignore no-explicit-any
  supabaseService: any,
  businessId: string,
  totalAmount: number
): Promise<number> {
  let score = 100

  try {
    // Check business verification status
    const { data: business } = await supabaseService
      .from('businesses')
      .select('verification_status, is_flagged, created_at')
      .eq('id', businessId)
      .maybeSingle()

    if (business) {
      // Unverified business: -30
      if (business.verification_status !== 'verified') score -= 30
      // Flagged business: -25
      if (business.is_flagged) score -= 25
      // Account < 7 days old: -20
      const ageMs = Date.now() - new Date(business.created_at).getTime()
      if (ageMs < 7 * 24 * 60 * 60 * 1000) score -= 20
    }

    // Amount > $5,000 equivalent: -10
    if (totalAmount > 5000) score -= 10

    // No previous issued invoices: -15
    const { count } = await supabaseService
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .neq('status', 'draft')

    if (count === 0) score -= 15
  } catch (err) {
    console.error('Trust score computation error:', err)
  }

  return Math.max(0, score)
}

// Validate invoice sanity before issuance
async function validateInvoiceSanity(
  // deno-lint-ignore no-explicit-any
  supabaseService: any,
  invoiceId: string,
  businessId: string,
  totalAmount: number
): Promise<string | null> {
  // Amount must be > 0
  if (totalAmount <= 0) {
    return 'Invoice total amount must be greater than zero.'
  }

  // Must have at least one line item with description, quantity, and price
  const { data: items, error: itemsError } = await supabaseService
    .from('invoice_items')
    .select('description, quantity, unit_price')
    .eq('invoice_id', invoiceId)

  if (itemsError || !items || items.length === 0) {
    return 'Invoice must have at least one line item.'
  }

  const validItems = items.filter(
    // deno-lint-ignore no-explicit-any
    (item: any) => item.description && item.quantity > 0 && item.unit_price > 0
  )
  if (validItems.length === 0) {
    return 'Each line item must have a description, quantity > 0, and unit price > 0.'
  }

  // Flag (don't block) new accounts with high amounts
  const { data: business } = await supabaseService
    .from('businesses')
    .select('created_at')
    .eq('id', businessId)
    .maybeSingle()

  if (business) {
    const ageMs = Date.now() - new Date(business.created_at).getTime()
    const isNew = ageMs < 30 * 24 * 60 * 60 * 1000 // < 30 days

    if (isNew && totalAmount > 10000) {
      // Insert fraud flag but don't block
      try {
        await supabaseService.from('fraud_flags').insert({
          business_id: businessId,
          invoice_id: invoiceId,
          reason: 'HIGH_AMOUNT_NEW_ACCOUNT',
          severity: 'medium',
          metadata: {
            total_amount: totalAmount,
            account_age_days: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
          },
        })
        console.log('Fraud flag created for high amount on new account')
      } catch (err) {
        console.error('Failed to create fraud flag:', err)
      }
    }
  }

  return null // No blocking error
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

    // Service client for validations that bypass RLS
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Rate limiting: check invoice issuance rate
    const rateLimitAllowed = await checkRateLimit(supabaseServiceKey, userId, 'issue_invoice', 30, 3600)
    if (!rateLimitAllowed) {
      return rateLimitResponse(corsHeaders)
    }

    // Fetch invoice details for sanity checks
    const { data: invoiceData } = await supabaseService
      .from('invoices')
      .select('total_amount, business_id')
      .eq('id', body.invoice_id)
      .maybeSingle()

    if (!invoiceData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found' } as IssueInvoiceResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Business profile completeness check
    const { data: businessProfile } = await supabaseService
      .from('businesses')
      .select('name, legal_name, contact_email, jurisdiction, tax_id, address, entity_type')
      .eq('id', invoiceData.business_id)
      .maybeSingle()

    if (businessProfile) {
      const missingFields: string[] = []
      if (!businessProfile.name?.trim()) missingFields.push('Business Name')
      if (!businessProfile.contact_email?.trim()) missingFields.push('Contact Email')
      if (!businessProfile.jurisdiction?.trim()) missingFields.push('Country')
      
      const address = businessProfile.address as { country?: string } | null
      if (!address?.country?.trim()) missingFields.push('Address Country')

      if (businessProfile.entity_type !== 'individual') {
        if (!businessProfile.legal_name?.trim()) missingFields.push('Legal Name')
        if (!businessProfile.tax_id?.trim()) missingFields.push('Tax ID')
      }

      if (missingFields.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Business profile incomplete. Missing: ${missingFields.join(', ')}. Please complete your business profile before issuing invoices.`,
            missing_fields: missingFields
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Invoice sanity checks
    const sanityError = await validateInvoiceSanity(
      supabaseService,
      body.invoice_id,
      invoiceData.business_id,
      Number(invoiceData.total_amount)
    )
    if (sanityError) {
      return new Response(
        JSON.stringify({ success: false, error: sanityError } as IssueInvoiceResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Compute trust score
    const trustScore = await computeTrustScore(
      supabaseService,
      invoiceData.business_id,
      Number(invoiceData.total_amount)
    )

    // Call the database function to issue the invoice
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

    // Update trust score on the issued invoice
    await supabaseService
      .from('invoices')
      .update({ trust_score: trustScore })
      .eq('id', issuedInvoice.id)

    // Create notification for invoice issued
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

    // Check if this is the first invoice for the business
    const { count: invoiceCount, error: countError } = await supabaseService
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', issuedInvoice.business_id)
      .neq('status', 'draft')

    if (!countError && invoiceCount === 1) {
      await supabaseService.rpc('notify_admin_first_invoice_issued', {
        _business_id: issuedInvoice.business_id,
        _invoice_id: issuedInvoice.id,
        _invoice_number: issuedInvoice.invoice_number
      })
      console.log('Admin notification created for first invoice milestone')
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
    captureException(error, { function_name: 'issue-invoice' })
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
