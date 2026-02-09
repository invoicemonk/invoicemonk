import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface ReportRequest {
  report_type: 'revenue-summary' | 'invoice-register' | 'tax-report' | 'audit-export'
  year: number
  format?: 'json' | 'csv'
  business_id?: string
}

interface RevenueSummary {
  period: string
  total_revenue: number
  invoice_count: number
  tax_collected: number
  currency: string
}

interface InvoiceRegisterEntry {
  invoice_number: string
  issue_date: string | null
  client_name: string
  total_amount: number
  tax_amount: number
  currency: string
  exchange_rate_to_primary: number | null
  primary_currency_equivalent: number
  status: string
  invoice_hash: string | null
}

interface TaxReportEntry {
  month: string
  taxable_amount: number
  tax_collected: number
  invoice_count: number
  currency: string
}

interface AuditExportEntry {
  timestamp: string
  event_type: string
  entity_type: string
  entity_id: string | null
  actor_id: string | null
  actor_role: string | null
  event_hash: string | null
}

interface ReportResponse {
  success: boolean
  report_type?: string
  generated_at?: string
  data?: unknown
  summary?: Record<string, unknown>
  error?: string
  upgrade_required?: boolean
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authorization required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // User client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Service client for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid or expired token' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body first to get business_id
    const body: ReportRequest = await req.json()
    const { report_type, year, format = 'json', business_id: requestBusinessId } = body

    if (!report_type || !year) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'report_type and year are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user's business (prefer from request, fall back to first membership)
    let businessId = requestBusinessId
    if (!businessId) {
      const { data: businessMember } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      businessId = businessMember?.business_id
    }

    // Verify user has access to this business
    if (businessId) {
      const { data: membership } = await supabase
        .from('business_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle()
      
      if (!membership) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'You do not have access to this business' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // TIER ENFORCEMENT: Check if business has reports access (using business-level check)
    const { data: tierCheck } = await supabase.rpc('check_tier_limit_business', {
      _business_id: businessId,
      _feature: 'reports_enabled'
    })

    console.log('Tier check result:', tierCheck)

    if (!tierCheck?.allowed) {
      const response: ReportResponse = {
        success: false,
        error: 'Reports require a Professional subscription or higher.',
        upgrade_required: true
      }
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Date range for the year
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    let reportData: unknown
    let summary: Record<string, unknown> = {}

    switch (report_type) {
      case 'revenue-summary': {
        // Monthly revenue breakdown with multi-currency support
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('issue_date, total_amount, tax_amount, currency, status, exchange_rate_to_primary')
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true })

        if (error) throw error

        // Get business primary currency
        const { data: business } = await supabase
          .from('businesses')
          .select('default_currency')
          .eq('id', businessId)
          .single()
        
        const primaryCurrency = business?.default_currency || 'NGN'

        // Group by month with currency conversion
        const monthlyData: Record<string, RevenueSummary> = {}
        let totalRevenue = 0
        let totalTax = 0
        const currencyBreakdown: Record<string, { total: number; count: number }> = {}

        invoices?.forEach(inv => {
          const month = inv.issue_date?.substring(0, 7) || 'Unknown'
          const invCurrency = inv.currency || primaryCurrency
          const amount = inv.total_amount || 0
          const taxAmount = inv.tax_amount || 0
          
          // Convert to primary currency if needed
          const rate = inv.exchange_rate_to_primary || 1
          const convertedAmount = invCurrency === primaryCurrency ? amount : amount * rate
          const convertedTax = invCurrency === primaryCurrency ? taxAmount : taxAmount * rate
          
          if (!monthlyData[month]) {
            monthlyData[month] = {
              period: month,
              total_revenue: 0,
              invoice_count: 0,
              tax_collected: 0,
              currency: primaryCurrency
            }
          }
          monthlyData[month].total_revenue += convertedAmount
          monthlyData[month].tax_collected += convertedTax
          monthlyData[month].invoice_count += 1
          totalRevenue += convertedAmount
          totalTax += convertedTax
          
          // Track currency breakdown
          if (!currencyBreakdown[invCurrency]) {
            currencyBreakdown[invCurrency] = { total: 0, count: 0 }
          }
          currencyBreakdown[invCurrency].total += amount
          currencyBreakdown[invCurrency].count += 1
        })

        reportData = Object.values(monthlyData)
        summary = {
          total_revenue: totalRevenue,
          total_tax: totalTax,
          total_invoices: invoices?.length || 0,
          currency: primaryCurrency,
          currency_breakdown: currencyBreakdown
        }
        break
      }

      case 'invoice-register': {
        // Complete list of issued invoices with immutable data and exchange rate
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select(`
            invoice_number,
            issue_date,
            total_amount,
            tax_amount,
            currency,
            status,
            invoice_hash,
            recipient_snapshot,
            exchange_rate_to_primary,
            exchange_rate_snapshot
          `)
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .neq('status', 'draft')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true })

        if (error) throw error

        // Get primary currency
        const { data: business } = await supabase
          .from('businesses')
          .select('default_currency')
          .eq('id', businessId)
          .single()
        
        const primaryCurrency = business?.default_currency || 'NGN'

        reportData = invoices?.map(inv => {
          const rate = inv.exchange_rate_to_primary || 1
          const invCurrency = inv.currency || primaryCurrency
          const primaryEquivalent = invCurrency === primaryCurrency 
            ? inv.total_amount 
            : (inv.total_amount || 0) * rate
          
          return {
            invoice_number: inv.invoice_number,
            issue_date: inv.issue_date,
            client_name: (inv.recipient_snapshot as Record<string, unknown>)?.name || 'Unknown',
            total_amount: inv.total_amount,
            tax_amount: inv.tax_amount,
            currency: inv.currency,
            exchange_rate_to_primary: inv.exchange_rate_to_primary,
            primary_currency_equivalent: primaryEquivalent,
            status: inv.status,
            invoice_hash: inv.invoice_hash
          }
        }) as InvoiceRegisterEntry[]

        summary = {
          total_invoices: invoices?.length || 0,
          total_amount: invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0,
          primary_currency: primaryCurrency
        }
        break
      }

      case 'tax-report': {
        // Tax summary by month for filing, converted to primary currency
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('issue_date, subtotal, tax_amount, currency, exchange_rate_to_primary')
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true })

        if (error) throw error

        // Get primary currency for this report
        const { data: businessData } = await supabase
          .from('businesses')
          .select('default_currency')
          .eq('id', businessId)
          .single()
        
        const primaryCurrency = businessData?.default_currency || 'NGN'

        const monthlyTax: Record<string, TaxReportEntry> = {}
        let totalTaxable = 0
        let totalTax = 0
        const currencyBreakdown: Record<string, { taxable: number; tax: number; count: number }> = {}

        invoices?.forEach(inv => {
          const rate = inv.exchange_rate_to_primary || 1
          const convertedSubtotal = (inv.subtotal || 0) * rate
          const convertedTax = (inv.tax_amount || 0) * rate
          const month = inv.issue_date?.substring(0, 7) || 'Unknown'

          if (!monthlyTax[month]) {
            monthlyTax[month] = {
              month,
              taxable_amount: 0,
              tax_collected: 0,
              invoice_count: 0,
              currency: primaryCurrency
            }
          }
          monthlyTax[month].taxable_amount += convertedSubtotal
          monthlyTax[month].tax_collected += convertedTax
          monthlyTax[month].invoice_count += 1
          totalTaxable += convertedSubtotal
          totalTax += convertedTax

          // Track per-currency breakdown in original amounts
          const invCurrency = inv.currency || primaryCurrency
          if (!currencyBreakdown[invCurrency]) {
            currencyBreakdown[invCurrency] = { taxable: 0, tax: 0, count: 0 }
          }
          currencyBreakdown[invCurrency].taxable += inv.subtotal || 0
          currencyBreakdown[invCurrency].tax += inv.tax_amount || 0
          currencyBreakdown[invCurrency].count += 1
        })

        reportData = Object.values(monthlyTax)
        summary = {
          total_taxable_amount: totalTaxable,
          total_tax_collected: totalTax,
          total_invoices: invoices?.length || 0,
          primary_currency: primaryCurrency,
          currency: primaryCurrency,
          currency_breakdown: currencyBreakdown
        }
        break
      }

      case 'audit-export': {
        // Audit trail with hashes for compliance
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select(`
            timestamp_utc,
            event_type,
            entity_type,
            entity_id,
            actor_id,
            actor_role,
            event_hash
          `)
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .gte('timestamp_utc', startDate)
          .lte('timestamp_utc', `${endDate}T23:59:59Z`)
          .order('timestamp_utc', { ascending: true })

        if (error) throw error

        reportData = logs?.map(log => ({
          timestamp: log.timestamp_utc,
          event_type: log.event_type,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          actor_id: log.actor_id,
          actor_role: log.actor_role,
          event_hash: log.event_hash
        })) as AuditExportEntry[]

        summary = {
          total_events: logs?.length || 0,
          event_types: [...new Set(logs?.map(l => l.event_type) || [])]
        }
        break
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unknown report type: ${report_type}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Log the export for audit trail
    try {
      await supabase.rpc('log_audit_event', {
        _entity_type: 'report',
        _event_type: 'DATA_EXPORTED',
        _user_id: user.id,
        _business_id: businessId,
        _metadata: {
          report_type,
          year,
          format,
          record_count: Array.isArray(reportData) ? reportData.length : 0
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
    }

    // Format response
    if (format === 'csv' && Array.isArray(reportData) && reportData.length > 0) {
      // Convert to CSV
      const headers = Object.keys(reportData[0] as Record<string, unknown>)
      const csvRows = [
        headers.join(','),
        ...reportData.map(row => 
          headers.map(h => {
            const val = (row as Record<string, unknown>)[h]
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
          }).join(',')
        )
      ]
      
      return new Response(csvRows.join('\n'), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${report_type}-${year}.csv"`
        }
      })
    }

    const response: ReportResponse = {
      success: true,
      report_type,
      generated_at: new Date().toISOString(),
      data: reportData,
      summary
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Report generation error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'An unexpected error occurred while generating the report'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
