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

    // TIER ENFORCEMENT: Check if user has reports access
    const { data: tierCheck } = await supabase.rpc('check_tier_limit', {
      _user_id: user.id,
      _feature: 'reports_enabled'
    })

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

    // Parse request body
    const body: ReportRequest = await req.json()
    const { report_type, year, format = 'json' } = body

    if (!report_type || !year) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'report_type and year are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user's business
    const { data: businessMember } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const businessId = businessMember?.business_id

    // Date range for the year
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    let reportData: unknown
    let summary: Record<string, unknown> = {}

    switch (report_type) {
      case 'revenue-summary': {
        // Monthly revenue breakdown
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('issue_date, total_amount, tax_amount, currency, status')
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true })

        if (error) throw error

        // Group by month
        const monthlyData: Record<string, RevenueSummary> = {}
        let totalRevenue = 0
        let totalTax = 0
        const currency = invoices?.[0]?.currency || 'NGN'

        invoices?.forEach(inv => {
          const month = inv.issue_date?.substring(0, 7) || 'Unknown'
          if (!monthlyData[month]) {
            monthlyData[month] = {
              period: month,
              total_revenue: 0,
              invoice_count: 0,
              tax_collected: 0,
              currency
            }
          }
          monthlyData[month].total_revenue += inv.total_amount || 0
          monthlyData[month].tax_collected += inv.tax_amount || 0
          monthlyData[month].invoice_count += 1
          totalRevenue += inv.total_amount || 0
          totalTax += inv.tax_amount || 0
        })

        reportData = Object.values(monthlyData)
        summary = {
          total_revenue: totalRevenue,
          total_tax: totalTax,
          total_invoices: invoices?.length || 0,
          currency
        }
        break
      }

      case 'invoice-register': {
        // Complete list of issued invoices with immutable data
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
            recipient_snapshot
          `)
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .neq('status', 'draft')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true })

        if (error) throw error

        reportData = invoices?.map(inv => ({
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date,
          client_name: (inv.recipient_snapshot as Record<string, unknown>)?.name || 'Unknown',
          total_amount: inv.total_amount,
          tax_amount: inv.tax_amount,
          currency: inv.currency,
          status: inv.status,
          invoice_hash: inv.invoice_hash
        })) as InvoiceRegisterEntry[]

        summary = {
          total_invoices: invoices?.length || 0,
          total_amount: invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0
        }
        break
      }

      case 'tax-report': {
        // Tax summary by month for filing
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('issue_date, subtotal, tax_amount, currency')
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true })

        if (error) throw error

        const monthlyTax: Record<string, TaxReportEntry> = {}
        let totalTaxable = 0
        let totalTax = 0
        const currency = invoices?.[0]?.currency || 'NGN'

        invoices?.forEach(inv => {
          const month = inv.issue_date?.substring(0, 7) || 'Unknown'
          if (!monthlyTax[month]) {
            monthlyTax[month] = {
              month,
              taxable_amount: 0,
              tax_collected: 0,
              invoice_count: 0,
              currency
            }
          }
          monthlyTax[month].taxable_amount += inv.subtotal || 0
          monthlyTax[month].tax_collected += inv.tax_amount || 0
          monthlyTax[month].invoice_count += 1
          totalTaxable += inv.subtotal || 0
          totalTax += inv.tax_amount || 0
        })

        reportData = Object.values(monthlyTax)
        summary = {
          total_taxable_amount: totalTaxable,
          total_tax_collected: totalTax,
          total_invoices: invoices?.length || 0,
          currency
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
