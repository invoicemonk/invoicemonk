import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dynamic CORS configuration
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

type FinancialReportType =
  | 'invoice-register'
  | 'revenue-by-period'
  | 'revenue-by-client'
  | 'outstanding-report'
  | 'receipt-register'
  | 'expense-register'
  | 'expense-by-category'
  | 'expense-by-vendor'
  | 'income-statement'
  | 'cash-flow-summary'
  | 'tax-report';

type NonFinancialReportType = 'audit-export' | 'export-history';

type ReportType = FinancialReportType | NonFinancialReportType;

// Financial reports require currency_account_id
const FINANCIAL_REPORT_TYPES: Set<string> = new Set([
  'invoice-register', 'revenue-by-period', 'revenue-by-client', 'outstanding-report',
  'receipt-register', 'expense-register', 'expense-by-category', 'expense-by-vendor',
  'income-statement', 'cash-flow-summary', 'tax-report',
]);

// Reports that require compliance tier (business)
const COMPLIANCE_REPORT_TYPES: Set<string> = new Set([
  'audit-export', 'export-history', 'tax-report',
]);

interface ReportRequest {
  report_type: ReportType;
  year: number;
  format?: 'json' | 'csv';
  business_id?: string;
  currency_account_id?: string;
}

interface ReportResponse {
  success: boolean;
  report_type?: string;
  generated_at?: string;
  currency?: string;
  currency_account_id?: string;
  data?: unknown;
  summary?: Record<string, unknown>;
  error?: string;
  upgrade_required?: boolean;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ReportRequest = await req.json();
    const { report_type, year, format = 'json', business_id: requestBusinessId, currency_account_id } = body;

    if (!report_type || !year) {
      return new Response(JSON.stringify({ success: false, error: 'report_type and year are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is platform admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'platform_admin',
    });
    const isPlatformAdmin = !!isAdmin;

    // Resolve business ID
    let businessId = requestBusinessId;
    if (!businessId) {
      const { data: bm } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      businessId = bm?.business_id;
    }

    // Verify business access (admins can access any business)
    if (businessId && !isPlatformAdmin) {
      const { data: membership } = await supabase
        .from('business_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ success: false, error: 'You do not have access to this business' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Tier enforcement (admins bypass)
    if (!isPlatformAdmin) {
      const { data: tierCheck } = await supabaseUser.rpc('check_tier_limit_business', {
        _business_id: businessId,
        _feature: 'reports_enabled',
      });

      if (!tierCheck?.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Reports require a Professional subscription or higher.',
          upgrade_required: true,
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Compliance reports require business tier
      if (COMPLIANCE_REPORT_TYPES.has(report_type)) {
        const { data: complianceCheck } = await supabaseUser.rpc('check_tier_limit_business', {
          _business_id: businessId,
          _feature: 'compliance_exports_enabled',
        });
        // If compliance feature check fails, still allow if reports_enabled passed (graceful degradation)
        if (complianceCheck && !complianceCheck.allowed) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Compliance reports require a Business subscription.',
            upgrade_required: true,
          }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // Financial reports MUST have currency_account_id
    const isFinancialReport = FINANCIAL_REPORT_TYPES.has(report_type);
    if (isFinancialReport && !currency_account_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'currency_account_id is required for financial reports. Select a currency account.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate currency account belongs to the business and get its currency
    let reportCurrency = 'NGN';
    if (currency_account_id) {
      const { data: ca, error: caError } = await supabase
        .from('currency_accounts')
        .select('currency, business_id')
        .eq('id', currency_account_id)
        .single();

      if (caError || !ca) {
        return new Response(JSON.stringify({ success: false, error: 'Currency account not found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (ca.business_id !== businessId) {
        return new Response(JSON.stringify({ success: false, error: 'Currency account does not belong to this business' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      reportCurrency = ca.currency;
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    let reportData: unknown;
    let summary: Record<string, unknown> = {};

    switch (report_type) {
      // ── REVENUE REPORTS ───────────────────────────────────────
      case 'invoice-register': {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select(`
            id, invoice_number, issue_date, total_amount, subtotal, tax_amount, discount_amount,
            amount_paid, currency, status, invoice_hash, recipient_snapshot, due_date
          `)
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .neq('status', 'draft')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true });

        if (error) throw error;

        // Get linked credit notes and receipt counts for these invoices
        const invoiceIds = (invoices || []).map(i => i.id);
        let creditNoteMap: Record<string, number> = {};
        let receiptCountMap: Record<string, number> = {};

        if (invoiceIds.length > 0) {
          const { data: creditNotes } = await supabase
            .from('credit_notes')
            .select('original_invoice_id, amount')
            .in('original_invoice_id', invoiceIds);

          for (const cn of creditNotes || []) {
            creditNoteMap[cn.original_invoice_id] = (creditNoteMap[cn.original_invoice_id] || 0) + Number(cn.amount);
          }

          const { data: receipts } = await supabase
            .from('receipts')
            .select('invoice_id')
            .in('invoice_id', invoiceIds);

          for (const r of receipts || []) {
            receiptCountMap[r.invoice_id] = (receiptCountMap[r.invoice_id] || 0) + 1;
          }
        }

        reportData = (invoices || []).map(inv => {
          const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
          return {
            invoice_number: inv.invoice_number,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            client_name: (inv.recipient_snapshot as Record<string, unknown>)?.name || 'Unknown',
            subtotal: inv.subtotal,
            tax_amount: inv.tax_amount,
            discount_amount: inv.discount_amount,
            total_amount: inv.total_amount,
            amount_paid: inv.amount_paid,
            outstanding_balance: outstanding,
            credit_note_amount: creditNoteMap[inv.id] || 0,
            receipt_count: receiptCountMap[inv.id] || 0,
            currency: inv.currency,
            status: inv.status,
            invoice_hash: inv.invoice_hash,
          };
        });

        const totalAmount = (invoices || []).reduce((s, i) => s + Number(i.total_amount), 0);
        const totalPaid = (invoices || []).reduce((s, i) => s + Number(i.amount_paid), 0);
        summary = {
          total_invoices: (invoices || []).length,
          total_amount: totalAmount,
          total_paid: totalPaid,
          total_outstanding: totalAmount - totalPaid,
          currency: reportCurrency,
        };
        break;
      }

      case 'revenue-by-period': {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('issue_date, total_amount, tax_amount')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true });

        if (error) throw error;

        const monthly: Record<string, { period: string; revenue: number; tax: number; count: number }> = {};
        let totalRevenue = 0;
        let totalTax = 0;

        for (const inv of invoices || []) {
          const month = inv.issue_date?.substring(0, 7) || 'Unknown';
          if (!monthly[month]) monthly[month] = { period: month, revenue: 0, tax: 0, count: 0 };
          monthly[month].revenue += Number(inv.total_amount);
          monthly[month].tax += Number(inv.tax_amount);
          monthly[month].count += 1;
          totalRevenue += Number(inv.total_amount);
          totalTax += Number(inv.tax_amount);
        }

        reportData = Object.values(monthly);
        summary = {
          total_revenue: totalRevenue,
          total_tax: totalTax,
          total_invoices: (invoices || []).length,
          currency: reportCurrency,
        };
        break;
      }

      case 'revenue-by-client': {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('total_amount, tax_amount, recipient_snapshot, status')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate);

        if (error) throw error;

        const clientMap: Record<string, { client_name: string; total_amount: number; tax_amount: number; invoice_count: number; paid_count: number }> = {};

        for (const inv of invoices || []) {
          const name = ((inv.recipient_snapshot as Record<string, unknown>)?.name as string) || 'Unknown';
          if (!clientMap[name]) clientMap[name] = { client_name: name, total_amount: 0, tax_amount: 0, invoice_count: 0, paid_count: 0 };
          clientMap[name].total_amount += Number(inv.total_amount);
          clientMap[name].tax_amount += Number(inv.tax_amount);
          clientMap[name].invoice_count += 1;
          if (inv.status === 'paid') clientMap[name].paid_count += 1;
        }

        reportData = Object.values(clientMap).sort((a, b) => b.total_amount - a.total_amount);
        summary = { total_clients: Object.keys(clientMap).length, currency: reportCurrency };
        break;
      }

      case 'outstanding-report': {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('invoice_number, issue_date, due_date, total_amount, amount_paid, recipient_snapshot, status')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .in('status', ['issued', 'sent', 'viewed'])
          .order('due_date', { ascending: true });

        if (error) throw error;

        const today = new Date();
        reportData = (invoices || []).map(inv => {
          const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
          const dueDate = inv.due_date ? new Date(inv.due_date) : null;
          const daysOverdue = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (86400000)) : 0;
          return {
            invoice_number: inv.invoice_number,
            client_name: (inv.recipient_snapshot as Record<string, unknown>)?.name || 'Unknown',
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            total_amount: inv.total_amount,
            amount_paid: inv.amount_paid,
            outstanding_balance: outstanding,
            days_overdue: Math.max(0, daysOverdue),
            status: inv.status,
            currency: reportCurrency,
          };
        }).filter(r => r.outstanding_balance > 0);

        const totalOutstanding = (reportData as Array<{ outstanding_balance: number }>).reduce((s, r) => s + r.outstanding_balance, 0);
        summary = { total_outstanding: totalOutstanding, total_invoices: (reportData as unknown[]).length, currency: reportCurrency };
        break;
      }

      // ── RECEIPT REPORTS ───────────────────────────────────────
      case 'receipt-register': {
        const { data: receipts, error } = await supabase
          .from('receipts')
          .select('receipt_number, amount, currency, issued_at, receipt_hash, verification_id, invoice_id, invoice_snapshot, payer_snapshot, payment_snapshot')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('issued_at', startDate)
          .lte('issued_at', `${endDate}T23:59:59Z`)
          .order('issued_at', { ascending: true });

        if (error) throw error;

        reportData = (receipts || []).map(r => ({
          receipt_number: r.receipt_number,
          amount: r.amount,
          currency: r.currency,
          issued_at: r.issued_at,
          invoice_number: (r.invoice_snapshot as Record<string, unknown>)?.invoice_number || '',
          payer_name: (r.payer_snapshot as Record<string, unknown>)?.name || 'Unknown',
          payment_method: (r.payment_snapshot as Record<string, unknown>)?.payment_method || '',
          payment_date: (r.payment_snapshot as Record<string, unknown>)?.payment_date || '',
          receipt_hash: r.receipt_hash,
          verification_id: r.verification_id,
        }));

        const totalReceiptAmount = (receipts || []).reduce((s, r) => s + Number(r.amount), 0);
        summary = { total_receipts: (receipts || []).length, total_amount: totalReceiptAmount, currency: reportCurrency };
        break;
      }

      // ── EXPENSE REPORTS ───────────────────────────────────────
      case 'expense-register': {
        const { data: expenses, error } = await supabase
          .from('expenses')
          .select('expense_date, category, description, vendor, amount, currency, notes')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate)
          .order('expense_date', { ascending: true });

        if (error) throw error;

        reportData = expenses || [];
        const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
        summary = { total_expenses: totalExpenses, total_records: (expenses || []).length, currency: reportCurrency };
        break;
      }

      case 'expense-by-category': {
        const { data: expenses, error } = await supabase
          .from('expenses')
          .select('category, amount')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);

        if (error) throw error;

        const catMap: Record<string, { category: string; total_amount: number; count: number }> = {};
        for (const e of expenses || []) {
          if (!catMap[e.category]) catMap[e.category] = { category: e.category, total_amount: 0, count: 0 };
          catMap[e.category].total_amount += Number(e.amount);
          catMap[e.category].count += 1;
        }

        reportData = Object.values(catMap).sort((a, b) => b.total_amount - a.total_amount);
        summary = { total_categories: Object.keys(catMap).length, currency: reportCurrency };
        break;
      }

      case 'expense-by-vendor': {
        const { data: expenses, error } = await supabase
          .from('expenses')
          .select('vendor, amount, category')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);

        if (error) throw error;

        const vendorMap: Record<string, { vendor: string; total_amount: number; count: number }> = {};
        for (const e of expenses || []) {
          const vName = e.vendor || 'Unspecified';
          if (!vendorMap[vName]) vendorMap[vName] = { vendor: vName, total_amount: 0, count: 0 };
          vendorMap[vName].total_amount += Number(e.amount);
          vendorMap[vName].count += 1;
        }

        reportData = Object.values(vendorMap).sort((a, b) => b.total_amount - a.total_amount);
        summary = { total_vendors: Object.keys(vendorMap).length, currency: reportCurrency };
        break;
      }

      // ── ACCOUNTING REPORTS ────────────────────────────────────
      case 'income-statement': {
        // Revenue (non-draft, non-voided invoices)
        const { data: invoices, error: invError } = await supabase
          .from('invoices')
          .select('total_amount, tax_amount')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate);

        if (invError) throw invError;

        // Expenses
        const { data: expenses, error: expError } = await supabase
          .from('expenses')
          .select('amount, category')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);

        if (expError) throw expError;

        // Credit notes (reduce revenue)
        const { data: creditNotes, error: cnError } = await supabase
          .from('credit_notes')
          .select('amount')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('issued_at', startDate)
          .lte('issued_at', `${endDate}T23:59:59Z`);

        if (cnError) throw cnError;

        const grossRevenue = (invoices || []).reduce((s, i) => s + Number(i.total_amount), 0);
        const totalTax = (invoices || []).reduce((s, i) => s + Number(i.tax_amount), 0);
        const totalCreditNotes = (creditNotes || []).reduce((s, c) => s + Number(c.amount), 0);
        const netRevenue = grossRevenue - totalCreditNotes;
        const totalExpenseAmount = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
        const netIncome = netRevenue - totalExpenseAmount;

        // Expense breakdown by category
        const expByCat: Record<string, number> = {};
        for (const e of expenses || []) {
          expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount);
        }

        reportData = {
          gross_revenue: grossRevenue,
          credit_notes: totalCreditNotes,
          net_revenue: netRevenue,
          tax_collected: totalTax,
          total_expenses: totalExpenseAmount,
          expense_breakdown: expByCat,
          net_income: netIncome,
          currency: reportCurrency,
          period: `${year}-01-01 to ${year}-12-31`,
        };

        summary = { net_income: netIncome, gross_revenue: grossRevenue, total_expenses: totalExpenseAmount, currency: reportCurrency };
        break;
      }

      case 'cash-flow-summary': {
        // Cash inflow = payments received
        const { data: payments, error: payError } = await supabase
          .from('payments')
          .select('amount, payment_date, invoice_id')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        if (payError) throw payError;

        // Filter payments to only those for invoices in this business + currency account
        const { data: bizInvoices } = await supabase
          .from('invoices')
          .select('id')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id);

        const validInvoiceIds = new Set((bizInvoices || []).map(i => i.id));
        const filteredPayments = (payments || []).filter(p => validInvoiceIds.has(p.invoice_id));

        // Cash outflow = expenses
        const { data: expenses, error: expError } = await supabase
          .from('expenses')
          .select('amount, expense_date')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);

        if (expError) throw expError;

        // Monthly breakdown
        const months: Record<string, { period: string; inflow: number; outflow: number; net: number }> = {};
        for (let m = 0; m < 12; m++) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`;
          months[key] = { period: key, inflow: 0, outflow: 0, net: 0 };
        }

        for (const p of filteredPayments) {
          const month = p.payment_date?.substring(0, 7);
          if (month && months[month]) {
            months[month].inflow += Number(p.amount);
          }
        }

        for (const e of expenses || []) {
          const month = e.expense_date?.substring(0, 7);
          if (month && months[month]) {
            months[month].outflow += Number(e.amount);
          }
        }

        for (const m of Object.values(months)) {
          m.net = m.inflow - m.outflow;
        }

        const totalInflow = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
        const totalOutflow = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);

        reportData = Object.values(months);
        summary = { total_inflow: totalInflow, total_outflow: totalOutflow, net_position: totalInflow - totalOutflow, currency: reportCurrency };
        break;
      }

      // ── COMPLIANCE REPORTS ────────────────────────────────────
      case 'tax-report': {
        // Invoices for tax calculation
        const { data: invoices, error: invError } = await supabase
          .from('invoices')
          .select('issue_date, subtotal, tax_amount')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .neq('status', 'draft')
          .neq('status', 'voided')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .order('issue_date', { ascending: true });

        if (invError) throw invError;

        // Credit notes reduce taxable amounts
        const { data: creditNotes, error: cnError } = await supabase
          .from('credit_notes')
          .select('issued_at, amount')
          .eq('business_id', businessId)
          .eq('currency_account_id', currency_account_id)
          .gte('issued_at', startDate)
          .lte('issued_at', `${endDate}T23:59:59Z`);

        if (cnError) throw cnError;

        const monthlyTax: Record<string, { month: string; taxable_amount: number; tax_collected: number; invoice_count: number; credit_note_adjustment: number; currency: string }> = {};
        let totalTaxable = 0;
        let totalTax = 0;

        for (const inv of invoices || []) {
          const month = inv.issue_date?.substring(0, 7) || 'Unknown';
          if (!monthlyTax[month]) {
            monthlyTax[month] = { month, taxable_amount: 0, tax_collected: 0, invoice_count: 0, credit_note_adjustment: 0, currency: reportCurrency };
          }
          monthlyTax[month].taxable_amount += Number(inv.subtotal);
          monthlyTax[month].tax_collected += Number(inv.tax_amount);
          monthlyTax[month].invoice_count += 1;
          totalTaxable += Number(inv.subtotal);
          totalTax += Number(inv.tax_amount);
        }

        // Apply credit note deductions
        let totalCreditNoteAdj = 0;
        for (const cn of creditNotes || []) {
          const month = (cn.issued_at as string)?.substring(0, 7) || 'Unknown';
          if (monthlyTax[month]) {
            monthlyTax[month].credit_note_adjustment += Number(cn.amount);
          }
          totalCreditNoteAdj += Number(cn.amount);
        }

        reportData = Object.values(monthlyTax);
        summary = {
          total_taxable_amount: totalTaxable,
          total_tax_collected: totalTax,
          total_credit_note_adjustments: totalCreditNoteAdj,
          net_taxable: totalTaxable - totalCreditNoteAdj,
          total_invoices: (invoices || []).length,
          currency: reportCurrency,
        };
        break;
      }

      case 'audit-export': {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('timestamp_utc, event_type, entity_type, entity_id, actor_id, actor_role, event_hash, previous_state, new_state, metadata')
          .or(`user_id.eq.${user.id},business_id.eq.${businessId}`)
          .gte('timestamp_utc', startDate)
          .lte('timestamp_utc', `${endDate}T23:59:59Z`)
          .order('timestamp_utc', { ascending: true });

        if (error) throw error;

        reportData = (logs || []).map(log => ({
          timestamp: log.timestamp_utc,
          event_type: log.event_type,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          actor_id: log.actor_id,
          actor_role: log.actor_role,
          event_hash: log.event_hash,
          previous_state: log.previous_state,
          new_state: log.new_state,
          metadata: log.metadata,
        }));

        summary = {
          total_events: (logs || []).length,
          event_types: [...new Set((logs || []).map(l => l.event_type))],
        };
        break;
      }

      case 'export-history': {
        let query = supabase
          .from('export_manifests')
          .select('id, export_type, format, record_count, timestamp_utc, integrity_hash, actor_email, scope')
          .order('timestamp_utc', { ascending: false });

        if (businessId) {
          query = query.eq('business_id', businessId);
        }

        const { data: manifests, error } = await query.limit(500);
        if (error) throw error;

        reportData = manifests || [];
        summary = { total_exports: (manifests || []).length };
        break;
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown report type: ${report_type}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
          currency_account_id: currency_account_id || null,
          currency: reportCurrency,
          record_count: Array.isArray(reportData) ? reportData.length : 1,
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    // CSV format
    if (format === 'csv' && Array.isArray(reportData) && reportData.length > 0) {
      const headers = Object.keys(reportData[0] as Record<string, unknown>);
      const csvRows = [
        headers.join(','),
        ...reportData.map(row =>
          headers.map(h => {
            const val = (row as Record<string, unknown>)[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) return `"${val.replace(/"/g, '""')}"`;
            return val;
          }).join(',')
        ),
      ];

      return new Response(csvRows.join('\n'), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${report_type}-${reportCurrency}-${year}.csv"`,
        },
      });
    }

    const response: ReportResponse = {
      success: true,
      report_type,
      generated_at: new Date().toISOString(),
      currency: reportCurrency,
      currency_account_id: currency_account_id || undefined,
      data: reportData,
      summary,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'An unexpected error occurred while generating the report',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
