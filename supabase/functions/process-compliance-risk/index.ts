import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


interface ComplianceRisk {
  invoice_id: string
  user_id: string
  business_id: string | null
  risk_type: string
  risk_severity: string
  details: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Authenticate: require CRON_SECRET header
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const incomingSecret = req.headers.get('x-cron-secret') ?? ''
  if (!cronSecret || incomingSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const today = now.toISOString().split('T')[0]

    // Fetch invoices to scan: issued in last 24h + all drafts
    const { data: recentIssued, error: issuedErr } = await adminClient
      .from('invoices')
      .select('id, user_id, business_id, status, subtotal, total_amount, tax_amount, due_date, amount_paid, client_id, tax_schema_id, invoice_number')
      .in('status', ['issued', 'sent', 'viewed'])
      .gte('issued_at', twentyFourHoursAgo)
      .not('user_id', 'is', null)

    const { data: drafts, error: draftErr } = await adminClient
      .from('invoices')
      .select('id, user_id, business_id, status, subtotal, total_amount, tax_amount, due_date, amount_paid, client_id, tax_schema_id, invoice_number')
      .eq('status', 'draft')
      .not('user_id', 'is', null)

    if (issuedErr) console.error('Error fetching issued invoices:', issuedErr)
    if (draftErr) console.error('Error fetching draft invoices:', draftErr)

    const allInvoices = [...(recentIssued || []), ...(drafts || [])]

    if (allInvoices.length === 0) {
      console.log('No invoices to scan')
      return new Response(
        JSON.stringify({ success: true, scanned: 0, risks_found: 0, risks_by_severity: { low: 0, medium: 0, high: 0 } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all client data for the invoices
    const clientIds = [...new Set(allInvoices.map((i) => i.client_id).filter(Boolean))]
    const { data: clients } = await adminClient
      .from('clients')
      .select('id, name, email')
      .in('id', clientIds)

    const clientMap: Record<string, { name: string | null; email: string | null }> = {}
    for (const c of clients || []) {
      clientMap[c.id] = { name: c.name, email: c.email }
    }

    // Fetch line item sums per invoice
    const invoiceIds = allInvoices.map((i) => i.id)
    const { data: items } = await adminClient
      .from('invoice_items')
      .select('invoice_id, amount')
      .in('invoice_id', invoiceIds)

    const itemSums: Record<string, number> = {}
    for (const item of items || []) {
      itemSums[item.invoice_id] = (itemSums[item.invoice_id] || 0) + Number(item.amount || 0)
    }

    // Fetch business VAT registration status
    const businessIds = [...new Set(allInvoices.map((i) => i.business_id).filter(Boolean))] as string[]
    const { data: businesses } = await adminClient
      .from('businesses')
      .select('id, is_vat_registered')
      .in('id', businessIds)

    const bizMap: Record<string, boolean> = {}
    for (const b of businesses || []) {
      bizMap[b.id] = b.is_vat_registered || false
    }

    // Run risk checks
    const risks: ComplianceRisk[] = []

    for (const inv of allInvoices) {
      const client = clientMap[inv.client_id]

      // 1. missing_client_info (high)
      if (!client || !client.email || !client.name) {
        risks.push({
          invoice_id: inv.id,
          user_id: inv.user_id!,
          business_id: inv.business_id,
          risk_type: 'missing_client_info',
          risk_severity: 'high',
          details: {
            invoice_number: inv.invoice_number,
            missing: !client ? 'client not found' : (!client.email ? 'email' : 'name'),
          },
        })
      }

      // 2. missing_tax_id (medium) — VAT-registered business, no tax schema
      if (inv.business_id && bizMap[inv.business_id] && !inv.tax_schema_id) {
        risks.push({
          invoice_id: inv.id,
          user_id: inv.user_id!,
          business_id: inv.business_id,
          risk_type: 'missing_tax_id',
          risk_severity: 'medium',
          details: {
            invoice_number: inv.invoice_number,
            reason: 'VAT-registered business but no tax schema applied',
          },
        })
      }

      // 3. amount_mismatch (high) — line item sum != subtotal
      const lineItemTotal = itemSums[inv.id] || 0
      const invoiceSubtotal = Number(inv.subtotal) || 0
      if (lineItemTotal > 0 && Math.abs(lineItemTotal - invoiceSubtotal) > 0.01) {
        risks.push({
          invoice_id: inv.id,
          user_id: inv.user_id!,
          business_id: inv.business_id,
          risk_type: 'amount_mismatch',
          risk_severity: 'high',
          details: {
            invoice_number: inv.invoice_number,
            line_item_total: lineItemTotal,
            invoice_subtotal: invoiceSubtotal,
            difference: Math.abs(lineItemTotal - invoiceSubtotal),
          },
        })
      }

      // 4. missing_due_date (medium) — non-draft with no due_date
      if (inv.status !== 'draft' && !inv.due_date) {
        risks.push({
          invoice_id: inv.id,
          user_id: inv.user_id!,
          business_id: inv.business_id,
          risk_type: 'missing_due_date',
          risk_severity: 'medium',
          details: {
            invoice_number: inv.invoice_number,
            reason: 'Issued invoice has no due date set',
          },
        })
      }

      // 5. overdue_unpaid (low) — past due with amount_paid < total_amount
      if (inv.due_date && inv.due_date < today && Number(inv.amount_paid) < Number(inv.total_amount)) {
        risks.push({
          invoice_id: inv.id,
          user_id: inv.user_id!,
          business_id: inv.business_id,
          risk_type: 'overdue_unpaid',
          risk_severity: 'low',
          details: {
            invoice_number: inv.invoice_number,
            due_date: inv.due_date,
            amount_paid: inv.amount_paid,
            total_amount: inv.total_amount,
          },
        })
      }
    }

    // Delete existing unresolved risks for scanned invoices, then insert new ones
    if (invoiceIds.length > 0) {
      await adminClient
        .from('compliance_risks')
        .delete()
        .in('invoice_id', invoiceIds)
        .eq('resolved', false)
    }

    if (risks.length > 0) {
      const { error: insertErr } = await adminClient
        .from('compliance_risks')
        .insert(risks)

      if (insertErr) {
        console.error('Error inserting compliance risks:', insertErr)
      }
    }

    const risksBySeverity = {
      low: risks.filter((r) => r.risk_severity === 'low').length,
      medium: risks.filter((r) => r.risk_severity === 'medium').length,
      high: risks.filter((r) => r.risk_severity === 'high').length,
    }

    const result = {
      success: true,
      scanned: allInvoices.length,
      risks_found: risks.length,
      risks_by_severity: risksBySeverity,
    }

    console.log('Compliance risk scan complete:', JSON.stringify(result))

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Compliance risk scan fatal error:', error)
    captureException(error, { function_name: 'process-compliance-risk' })
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
