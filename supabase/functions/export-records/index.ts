import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Validation utilities
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUUID(value: unknown, fieldName: string, required = true): string | null {
  if (value === null || value === undefined || value === '') {
    return required ? `${fieldName} is required` : null;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (!UUID_REGEX.test(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

function validateDate(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Optional
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value) || isNaN(new Date(value).getTime())) {
    return `${fieldName} must be a valid date (YYYY-MM-DD)`;
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

interface ExportRecordsRequest {
  export_type: 'invoices' | 'audit_logs' | 'payments' | 'clients' | 'expenses'
  business_id?: string
  currency_account_id?: string
  date_from?: string
  date_to?: string
  format?: 'csv' | 'json'
}

interface ExportRecordsResponse {
  success: boolean
  export_id?: string
  manifest_id?: string
  data?: string
  filename?: string
  record_count?: number
  generated_at?: string
  integrity_hash?: string
  error?: string
}

async function generateExportHash(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function convertToCSV(data: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',')
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

function getClientIP(req: Request): string | null {
  // Try various headers for IP
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  const realIP = req.headers.get('x-real-ip')
  if (realIP) return realIP
  return null
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
        JSON.stringify({ success: false, error: 'Unauthorized' } as ExportRecordsResponse),
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
        JSON.stringify({ success: false, error: 'Invalid authentication token' } as ExportRecordsResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id
    const userEmail = claimsData.user.email || 'unknown'

    // Get user role
    const { data: roleData } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .single()
    
    const actorRole = roleData?.role || 'user'

    // CHECK TIER LIMITS FOR EXPORTS (Server-side enforcement)
    const { data: tierCheck, error: tierError } = await supabaseUser.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'exports_enabled',
    })

    console.log('Tier check for exports:', tierCheck, tierError)

    if (tierError || !tierCheck?.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Data exports require a Professional subscription. Upgrade to export your financial records.',
          upgrade_required: true,
          tier: tierCheck?.tier || 'starter'
        } as ExportRecordsResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: ExportRecordsRequest = await req.json()
    
    if (!body.export_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Export type is required' } as ExportRecordsResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validExportTypes = ['invoices', 'audit_logs', 'payments', 'clients', 'expenses']
    if (!validExportTypes.includes(body.export_type)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid export type. Must be one of: ${validExportTypes.join(', ')}` 
        } as ExportRecordsResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const format = body.format || 'csv'
    const exportId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()
    
    // Capture chain of custody information
    const sourceIP = getClientIP(req)
    const userAgent = req.headers.get('user-agent') || null
    
    let data: Record<string, unknown>[] = []
    let columns: string[] = []
    let filename = ''

    // Build query based on export type
    switch (body.export_type) {
      case 'invoices': {
        let query = supabaseUser
          .from('invoices')
          .select(`
            invoice_number,
            status,
            issue_date,
            due_date,
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            amount_paid,
            currency,
            exchange_rate_to_primary,
            created_at,
            issued_at,
            issuer_snapshot,
            recipient_snapshot,
            tax_schema_version,
            clients!inner(name, email)
          `)
        
        if (body.business_id) {
          query = query.eq('business_id', body.business_id)
        }
        if (body.currency_account_id) {
          query = query.eq('currency_account_id', body.currency_account_id)
        }
        if (body.date_from) {
          query = query.gte('created_at', body.date_from)
        }
        if (body.date_to) {
          query = query.lte('created_at', body.date_to)
        }

        const { data: invoices, error } = await query.order('created_at', { ascending: false })
        
        if (error) throw error

        // Get business primary currency for reference
        let primaryCurrency = 'NGN'
        if (body.business_id) {
          const { data: business } = await supabaseService
            .from('businesses')
            .select('default_currency')
            .eq('id', body.business_id)
            .single()
          primaryCurrency = business?.default_currency || 'NGN'
        }
        
        data = (invoices || []).map(inv => {
          const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients
          const rate = inv.exchange_rate_to_primary || 1
          const invCurrency = inv.currency || primaryCurrency
          const primaryEquivalent = invCurrency === primaryCurrency 
            ? inv.total_amount 
            : (inv.total_amount || 0) * rate
          
          return {
            invoice_number: inv.invoice_number,
            client_name: client?.name || '',
            client_email: client?.email || '',
            status: inv.status,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            subtotal: inv.subtotal,
            tax_amount: inv.tax_amount,
            discount_amount: inv.discount_amount,
            total_amount: inv.total_amount,
            amount_paid: inv.amount_paid,
            currency: inv.currency,
            exchange_rate_to_primary: inv.exchange_rate_to_primary,
            primary_currency_equivalent: primaryEquivalent,
            primary_currency: primaryCurrency,
            created_at: inv.created_at,
            issued_at: inv.issued_at,
            issuer_snapshot: inv.issuer_snapshot,
            recipient_snapshot: inv.recipient_snapshot,
            tax_schema_version: inv.tax_schema_version
          }
        })
        
        columns = ['invoice_number', 'client_name', 'client_email', 'status', 'issue_date', 'due_date', 
                   'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'amount_paid', 'currency',
                   'exchange_rate_to_primary', 'primary_currency_equivalent', 'primary_currency',
                   'created_at', 'issued_at', 'issuer_snapshot', 'recipient_snapshot', 'tax_schema_version']
        filename = `invoices_export_${generatedAt.split('T')[0]}`
        break
      }

      case 'audit_logs': {
        let query = supabaseUser
          .from('audit_logs')
          .select('event_type, entity_type, entity_id, timestamp_utc, actor_role, metadata')
        
        if (body.business_id) {
          query = query.eq('business_id', body.business_id)
        }
        if (body.date_from) {
          query = query.gte('timestamp_utc', body.date_from)
        }
        if (body.date_to) {
          query = query.lte('timestamp_utc', body.date_to)
        }

        const { data: logs, error } = await query.order('timestamp_utc', { ascending: false }).limit(10000)
        
        if (error) throw error
        
        data = logs || []
        columns = ['event_type', 'entity_type', 'entity_id', 'timestamp_utc', 'actor_role', 'metadata']
        filename = `audit_logs_export_${generatedAt.split('T')[0]}`
        break
      }

      case 'payments': {
        let query = supabaseUser
          .from('payments')
          .select(`
            amount,
            payment_method,
            payment_reference,
            payment_date,
            notes,
            created_at,
            invoices!inner(invoice_number, total_amount)
          `)
        
        if (body.date_from) {
          query = query.gte('payment_date', body.date_from)
        }
        if (body.date_to) {
          query = query.lte('payment_date', body.date_to)
        }

        const { data: payments, error } = await query.order('payment_date', { ascending: false })
        
        if (error) throw error
        
        data = (payments || []).map(p => {
          const invoice = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices
          return {
            invoice_number: invoice?.invoice_number || '',
            invoice_total: invoice?.total_amount || 0,
            payment_amount: p.amount,
            payment_method: p.payment_method,
            payment_reference: p.payment_reference,
            payment_date: p.payment_date,
            notes: p.notes,
            recorded_at: p.created_at
          }
        })
        
        columns = ['invoice_number', 'invoice_total', 'payment_amount', 'payment_method', 
                   'payment_reference', 'payment_date', 'notes', 'recorded_at']
        filename = `payments_export_${generatedAt.split('T')[0]}`
        break
      }

      case 'clients': {
        let query = supabaseUser
          .from('clients')
          .select('name, email, phone, tax_id, address, notes, created_at, updated_at')
        
        if (body.business_id) {
          query = query.eq('business_id', body.business_id)
        }

        const { data: clients, error } = await query.order('name', { ascending: true })
        
        if (error) throw error
        
        data = clients || []
        columns = ['name', 'email', 'phone', 'tax_id', 'address', 'notes', 'created_at', 'updated_at']
        filename = `clients_export_${generatedAt.split('T')[0]}`
        break
      }

      case 'expenses': {
        let query = supabaseUser
          .from('expenses')
          .select('category, description, amount, currency, expense_date, vendor, notes, created_at, exchange_rate_to_primary, primary_currency')
        
        if (body.business_id) {
          query = query.eq('business_id', body.business_id)
        }
        if (body.currency_account_id) {
          query = query.eq('currency_account_id', body.currency_account_id)
        }
        if (body.date_from) {
          query = query.gte('expense_date', body.date_from)
        }
        if (body.date_to) {
          query = query.lte('expense_date', body.date_to)
        }

        const { data: expenses, error } = await query.order('expense_date', { ascending: false })
        
        if (error) throw error
        
        data = (expenses || []).map(exp => {
          const rate = exp.exchange_rate_to_primary || 1
          const expCurrency = exp.currency || 'NGN'
          const primaryCurr = exp.primary_currency || 'NGN'
          const primaryEquivalent = expCurrency === primaryCurr 
            ? exp.amount 
            : (exp.amount || 0) * rate
          
          return {
            expense_date: exp.expense_date,
            category: exp.category,
            description: exp.description || '',
            vendor: exp.vendor || '',
            amount: exp.amount,
            currency: exp.currency,
            exchange_rate_to_primary: exp.exchange_rate_to_primary,
            primary_currency_equivalent: primaryEquivalent,
            primary_currency: exp.primary_currency,
            notes: exp.notes || '',
            created_at: exp.created_at
          }
        })
        
        columns = ['expense_date', 'category', 'description', 'vendor', 'amount', 'currency', 
                   'exchange_rate_to_primary', 'primary_currency_equivalent', 'primary_currency',
                   'notes', 'created_at']
        filename = `expenses_export_${generatedAt.split('T')[0]}`
        break
      }
    }

    // Generate export content
    let exportContent: string
    if (format === 'csv') {
      exportContent = convertToCSV(data, columns)
      filename += '.csv'
    } else {
      exportContent = JSON.stringify(data, null, 2)
      filename += '.json'
    }

    // Generate integrity hash for the export
    const integrityHash = await generateExportHash(exportContent)

    // Build scope object for chain of custody
    const scope = {
      date_from: body.date_from || null,
      date_to: body.date_to || null,
      business_id: body.business_id || null,
      filters: {}
    }

    // Create export manifest for chain of custody
    let manifestId: string | null = null
    try {
      const { data: manifestData, error: manifestError } = await supabaseService
        .from('export_manifests')
        .insert({
          export_type: body.export_type,
          actor_id: userId,
          actor_email: userEmail,
          actor_role: actorRole,
          business_id: body.business_id || null,
          scope: scope,
          record_count: data.length,
          integrity_hash: integrityHash,
          format: format,
          source_ip: sourceIP,
          user_agent: userAgent
        })
        .select('id')
        .single()

      if (manifestError) {
        console.error('Export manifest error:', manifestError)
      } else {
        manifestId = manifestData.id
      }
    } catch (manifestErr) {
      console.error('Export manifest creation error:', manifestErr)
    }

    // Log the export event with manifest reference
    try {
      await supabaseService.rpc('log_audit_event', {
        _event_type: 'DATA_EXPORTED',
        _entity_type: body.export_type,
        _user_id: userId,
        _business_id: body.business_id || null,
        _metadata: {
          export_id: exportId,
          manifest_id: manifestId,
          export_type: body.export_type,
          format: format,
          record_count: data.length,
          date_range: {
            from: body.date_from || null,
            to: body.date_to || null
          },
          integrity_hash: integrityHash,
          actor_email: userEmail,
          actor_role: actorRole
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
    }

    const response: ExportRecordsResponse = {
      success: true,
      export_id: exportId,
      manifest_id: manifestId || undefined,
      data: exportContent,
      filename: filename,
      record_count: data.length,
      generated_at: generatedAt,
      integrity_hash: integrityHash
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Export records error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while exporting records' 
      } as ExportRecordsResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
