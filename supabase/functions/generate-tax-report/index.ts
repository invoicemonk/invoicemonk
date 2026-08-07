import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, checkRateLimit, rateLimitResponse, escapeHtml } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

type Jurisdiction = 'US' | 'GB' | 'EU' | 'NG' | 'XX'

interface RequestBody {
  business_id: string
  currency_account_id?: string
  currency: string
  jurisdiction: Jurisdiction
  start_date?: string // YYYY-MM-DD
  end_date?: string   // YYYY-MM-DD
  period_label?: string
  format?: 'print' | 'pdf' | 'csv' | 'json' // 'pdf' kept as alias for 'print' (HTML print-ready)
}

interface ReportLine {
  code: string
  label: string
  sortOrder: number
  rawTotal: number
  deductibleTotal: number
  count: number
  categories: string[]
}

const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  US: 'United States — Schedule C',
  GB: 'United Kingdom — Self-Assessment SA103',
  EU: 'EU — VAT-aware summary',
  NG: 'Nigeria — Deductible expenses',
  XX: 'Generic deductible expense report',
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const allowed = await checkRateLimit(supabaseServiceKey, `tax-report:${user.id}`, 'generate-tax-report', 60, 20)
    if (!allowed) return rateLimitResponse(corsHeaders)

    const body = (await req.json()) as RequestBody
    const {
      business_id: businessId,
      currency_account_id,
      currency,
      jurisdiction,
      start_date,
      end_date,
      period_label,
    } = body
    // Normalize: 'pdf' is a legacy alias for 'print' (branded HTML, print-to-PDF in browser)
    const format: 'print' | 'csv' | 'json' =
      body.format === 'csv' ? 'csv' : body.format === 'json' ? 'json' : 'print'

    if (!businessId || !currency || !jurisdiction) {
      return new Response(JSON.stringify({ success: false, error: 'business_id, currency and jurisdiction are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!['US', 'GB', 'EU', 'NG', 'XX'].includes(jurisdiction)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid jurisdiction' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Platform admin?
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'platform_admin' })
    const isPlatformAdmin = !!isAdmin

    // Business membership check
    if (!isPlatformAdmin) {
      const { data: membership } = await supabase
        .from('business_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle()
      if (!membership) {
        return new Response(JSON.stringify({ success: false, error: 'You do not have access to this business' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Print-ready (branded HTML) export is Pro+ gated; CSV is available to all tiers.
    if (format === 'print' && !isPlatformAdmin) {
      const { data: tierCheck } = await supabaseUser.rpc('check_tier_limit_business', {
        _business_id: businessId,
        _feature: 'reports_enabled',
      })
      if (!tierCheck?.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Print-ready report requires a Professional subscription or higher.',
          upgrade_required: true,
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Mappings
    const { data: mappings, error: mapErr } = await supabase
      .from('tax_report_mappings')
      .select('expense_category, report_line_code, report_line_label, sort_order, deductible_percent')
      .eq('jurisdiction', jurisdiction)
      .order('sort_order', { ascending: true })
    if (mapErr) throw mapErr

    const byCategory = new Map<string, typeof mappings[number]>()
    for (const m of mappings ?? []) byCategory.set(m.expense_category, m)

    // Expenses in scope
    let expensesQ = supabase
      .from('expenses')
      .select('category, amount, currency, vendor_id, tax_amount')
      .eq('business_id', businessId)
    if (currency_account_id) expensesQ = expensesQ.eq('currency_account_id', currency_account_id)
    if (start_date && end_date) expensesQ = expensesQ.gte('expense_date', start_date).lte('expense_date', end_date)
    const { data: expenses, error: expErr } = await expensesQ
    if (expErr) throw expErr

    // Invoices (for EU output VAT)
    let invoicesQ = supabase
      .from('invoices')
      .select('tax_amount, currency, status')
      .eq('business_id', businessId)
      .neq('status', 'draft')
      .neq('status', 'voided')
    if (currency_account_id) invoicesQ = invoicesQ.eq('currency_account_id', currency_account_id)
    if (start_date && end_date) invoicesQ = invoicesQ.gte('issue_date', start_date).lte('issue_date', end_date)
    const { data: invoices } = await invoicesQ

    // Aggregate
    const linesByCode = new Map<string, ReportLine>()
    let totalRaw = 0
    let totalDeductible = 0
    let inputVat = 0
    for (const exp of expenses ?? []) {
      if (exp.currency !== currency) continue
      const amount = Number(exp.amount) || 0
      inputVat += Number(exp.tax_amount) || 0
      const mapping = byCategory.get(exp.category) ?? byCategory.get('other')
      if (!mapping) continue
      const deductible = (amount * Number(mapping.deductible_percent)) / 100
      totalRaw += amount
      totalDeductible += deductible
      const existing = linesByCode.get(mapping.report_line_code)
      if (existing) {
        existing.rawTotal += amount
        existing.deductibleTotal += deductible
        existing.count += 1
        if (exp.category && !existing.categories.includes(exp.category)) existing.categories.push(exp.category)
      } else {
        linesByCode.set(mapping.report_line_code, {
          code: mapping.report_line_code,
          label: mapping.report_line_label,
          sortOrder: mapping.sort_order,
          rawTotal: amount,
          deductibleTotal: deductible,
          count: 1,
          categories: exp.category ? [exp.category] : [],
        })
      }
    }
    const lines = Array.from(linesByCode.values()).sort((a, b) => a.sortOrder - b.sortOrder)

    let outputVat = 0
    if (jurisdiction === 'EU') {
      for (const inv of invoices ?? []) {
        if (inv.currency !== currency) continue
        outputVat += Number(inv.tax_amount) || 0
      }
    }

    // Business header info
    let businessName = 'Business'
    let logoUrl: string | null = null
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, legal_name, logo_url')
      .eq('id', businessId)
      .maybeSingle()
    if (biz) {
      businessName = biz.legal_name || biz.name || 'Business'
      logoUrl = biz.logo_url ?? null
    }

    const generatedAt = new Date().toISOString()
    const periodText = period_label || (start_date && end_date ? `${start_date} → ${end_date}` : 'All time')
    const safeJurisdiction = jurisdiction.toLowerCase()
    const stamp = generatedAt.replace(/[:.]/g, '-')

    // ── JSON format (mobile app) ──
    if (format === 'json') {
      const payload = {
        success: true,
        generated_at: generatedAt,
        business: { id: businessId, name: businessName },
        jurisdiction,
        currency,
        period: { start_date: start_date ?? null, end_date: end_date ?? null, label: periodText },
        lines: lines.map(l => ({
          code: l.code,
          label: l.label,
          items: l.count,
          raw_total: Number(l.rawTotal.toFixed(2)),
          deductible_total: Number(l.deductibleTotal.toFixed(2)),
          categories: l.categories,
        })),
        totals: {
          raw_total: Number(totalRaw.toFixed(2)),
          deductible_total: Number(totalDeductible.toFixed(2)),
          items: lines.reduce((s, l) => s + l.count, 0),
        },
        vat: jurisdiction === 'EU' ? {
          output_vat: Number(outputVat.toFixed(2)),
          input_vat: Number(inputVat.toFixed(2)),
          net_position: Number((outputVat - inputVat).toFixed(2)),
        } : null,
      }
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── CSV format (all tiers) ──
    if (format === 'csv') {
      const rows: string[] = []
      rows.push(['Line code', 'Line', 'Items', `Raw total (${currency})`, `Deductible (${currency})`, 'Categories'].join(','))
      for (const l of lines) {
        rows.push([
          csvCell(l.code), csvCell(l.label), csvCell(l.count),
          csvCell(l.rawTotal.toFixed(2)), csvCell(l.deductibleTotal.toFixed(2)),
          csvCell(l.categories.join('; ')),
        ].join(','))
      }
      rows.push(['', 'TOTAL', csvCell(lines.reduce((s, l) => s + l.count, 0)), csvCell(totalRaw.toFixed(2)), csvCell(totalDeductible.toFixed(2)), ''].join(','))
      if (jurisdiction === 'EU') {
        rows.push('')
        rows.push(['VAT summary', '', '', '', '', ''].join(','))
        rows.push(['', 'Output VAT (collected)', '', csvCell(outputVat.toFixed(2)), '', ''].join(','))
        rows.push(['', 'Input VAT (reclaimable)', '', csvCell(inputVat.toFixed(2)), '', ''].join(','))
        rows.push(['', 'Net VAT position', '', csvCell((outputVat - inputVat).toFixed(2)), '', ''].join(','))
      }
      const csv = rows.join('\n')
      const filename = `tax-report-${safeJurisdiction}-${currency}-${stamp}.csv`

      // Store a copy in the bucket (best-effort)
      await supabase.storage.from('accounting-reports')
        .upload(`${businessId}/${filename}`, new Blob([csv], { type: 'text/csv' }), { contentType: 'text/csv', upsert: true })
        .catch((e) => captureException(e))

      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // ── Print-ready (branded, self-contained HTML — opens in tab, user prints or Saves as PDF) ──
    const rowsHtml = lines.map((l) => {
      const partial = Math.abs(l.deductibleTotal - l.rawTotal) > 0.005
      const pct = l.rawTotal > 0 ? Math.round((l.deductibleTotal / l.rawTotal) * 100) : 100
      return `<tr>
        <td>${escapeHtml(l.label)}${l.categories.length ? `<div class="cats">${l.categories.map((c) => escapeHtml(c)).join(' · ')}</div>` : ''}</td>
        <td class="num">${l.count}</td>
        <td class="num">${fmt(l.rawTotal, currency)}</td>
        <td class="num strong">${fmt(l.deductibleTotal, currency)}${partial ? `<div class="pct">${pct}% deductible</div>` : ''}</td>
      </tr>`
    }).join('')

    const vatHtml = jurisdiction === 'EU' ? `
      <h2>VAT position</h2>
      <table class="vat">
        <tr><td>Output VAT (collected on invoices)</td><td class="num">${fmt(outputVat, currency)}</td></tr>
        <tr><td>Input VAT (reclaimable on expenses)</td><td class="num">${fmt(inputVat, currency)}</td></tr>
        <tr class="total"><td>Net VAT position</td><td class="num strong">${fmt(outputVat - inputVat, currency)}</td></tr>
      </table>` : ''

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Tax Report — ${escapeHtml(businessName)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:40px;color:#1a2b27;font-size:13px;line-height:1.5}
  .print-bar{position:sticky;top:0;background:#1d6b5a;color:#fff;padding:10px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;font-size:13px}
  .print-bar button{background:#fff;color:#1d6b5a;border:none;padding:6px 14px;border-radius:4px;font-weight:600;cursor:pointer}
  .head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1d6b5a;padding-bottom:16px;margin-bottom:8px}
  .head img{max-height:48px;max-width:160px}
  .brand{font-size:18px;font-weight:700;color:#1d6b5a}
  h1{font-size:20px;margin:18px 0 2px}
  .meta{color:#6b7c78;font-size:12px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;margin-top:8px}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7c78;border-bottom:1px solid #cbd6d2;padding:8px 10px}
  td{padding:9px 10px;border-bottom:1px solid #e6ece9;vertical-align:top}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .strong{font-weight:700}
  .cats{font-size:10px;color:#8a9a95;margin-top:3px}
  .pct{font-size:10px;color:#b45309;margin-top:2px}
  tr.total td{border-top:2px solid #1d6b5a;border-bottom:none;font-weight:700;padding-top:12px}
  .total .num{color:#1d6b5a}
  table.vat{max-width:420px}
  h2{font-size:14px;margin-top:28px;color:#1a2b27}
  .disclaimer{margin-top:32px;padding:12px 14px;background:#fdf6e3;border:1px solid #e8d8a8;border-radius:6px;font-size:11px;color:#7a6314}
  .footer{margin-top:24px;padding-top:14px;border-top:1px solid #e6ece9;font-size:10px;color:#9aa8a3;display:flex;justify-content:space-between}
  @media print{
    body{margin:0}
    .no-print,.print-bar{display:none !important}
  }
</style></head>
<body>
  <div class="print-bar no-print">
    <span>Branded print-ready report — print this page or use your browser's "Save as PDF".</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="head">
    <div class="brand">${escapeHtml(businessName)}</div>
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="logo"/>` : ''}
  </div>
  <h1>Tax Report — ${escapeHtml(JURISDICTION_LABELS[jurisdiction])}</h1>
  <div class="meta">${escapeHtml(periodText)} · ${escapeHtml(currency)} · Generated ${new Date(generatedAt).toLocaleString('en-US')}</div>

  ${vatHtml}

  <h2>Deductible expense summary</h2>
  <table>
    <thead><tr><th>Line</th><th class="num">Items</th><th class="num">Raw total</th><th class="num">Deductible</th></tr></thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:#9aa8a3;padding:24px">No expenses recorded for this period.</td></tr>'}
      <tr class="total"><td>Total</td><td class="num">${lines.reduce((s, l) => s + l.count, 0)}</td><td class="num">${fmt(totalRaw, currency)}</td><td class="num">${fmt(totalDeductible, currency)}</td></tr>
    </tbody>
  </table>

  <div class="disclaimer">
    Informational summary — figures roll up from your recorded expenses and issued invoices in ${escapeHtml(currency)}.
    This is not a substitute for a licensed accountant or a filed return.
  </div>
  <div class="footer">
    <span>Generated by Invoicemonk · ${escapeHtml(JURISDICTION_LABELS[jurisdiction])}</span>
    <span>${new Date(generatedAt).toLocaleString('en-US')}</span>
  </div>
</body></html>`

    const filename = `tax-report-${safeJurisdiction}-${currency}-${stamp}.html`
    await supabase.storage.from('accounting-reports')
      .upload(`${businessId}/${filename}`, new Blob([html], { type: 'text/html' }), { contentType: 'text/html', upsert: true })
      .catch((e) => captureException(e))

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    captureException(error)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message || 'Failed to generate tax report' }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})