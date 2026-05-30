import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { type TaxReportJurisdiction } from '@/lib/tax-report-mappings';

export interface TaxReportMappingRow {
  id: string;
  jurisdiction: string;
  expense_category: string;
  report_line_code: string;
  report_line_label: string;
  sort_order: number;
  deductible_percent: number;
}

export interface TaxReportLine {
  code: string;
  label: string;
  sortOrder: number;
  rawTotal: number;        // sum of expense amounts
  deductibleTotal: number; // rawTotal * deductible_percent / 100
  count: number;
  categories: string[];    // contributing expense categories
}

export interface TaxReportData {
  jurisdiction: TaxReportJurisdiction;
  currency: string;
  lines: TaxReportLine[];
  totalRaw: number;
  totalDeductible: number;
  // EU-specific (only populated for jurisdiction === 'EU')
  vat?: {
    inputVat: number;
    outputVat: number;
    netPosition: number;
  };
  // Diagnostics for the "What's missing" panel
  diagnostics: {
    uncategorizedCount: number;
    missingVendorCount: number;
    pendingInboxCount: number;
  };
}

export function useTaxReportMappings(jurisdiction: TaxReportJurisdiction) {
  return useQuery({
    queryKey: ['tax-report-mappings', jurisdiction],
    queryFn: async (): Promise<TaxReportMappingRow[]> => {
      const { data, error } = await supabase
        .from('tax_report_mappings')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaxReportMappingRow[];
    },
  });
}

interface UseTaxReportArgs {
  businessId?: string;
  currencyAccountId?: string;
  currency: string;
  jurisdiction: TaxReportJurisdiction;
  dateRange?: { start: Date; end: Date };
}

export function useTaxReport({
  businessId,
  currencyAccountId,
  currency,
  jurisdiction,
  dateRange,
}: UseTaxReportArgs) {
  const { user } = useAuth();
  const { data: mappings } = useTaxReportMappings(jurisdiction);

  const startIso = dateRange?.start.toISOString().split('T')[0];
  const endIso = dateRange?.end.toISOString().split('T')[0];

  const query = useQuery({
    enabled: !!user && !!businessId && !!mappings,
    queryKey: [
      'tax-report',
      businessId,
      currencyAccountId,
      currency,
      jurisdiction,
      startIso,
      endIso,
    ],
    queryFn: async () => {
      if (!businessId) throw new Error('businessId required');

      // 1. Expenses in scope
      let expensesQ = supabase
        .from('expenses')
        .select('id, category, amount, currency, expense_date, vendor_id, tax_amount')
        .eq('business_id', businessId);
      if (currencyAccountId) expensesQ = expensesQ.eq('currency_account_id', currencyAccountId);
      if (startIso && endIso) expensesQ = expensesQ.gte('expense_date', startIso).lte('expense_date', endIso);
      const { data: expenses, error: expensesErr } = await expensesQ;
      if (expensesErr) throw expensesErr;

      // 2. Invoices in scope (for EU output VAT)
      let invoicesQ = supabase
        .from('invoices')
        .select('id, issue_date, tax_amount, currency, status')
        .eq('business_id', businessId)
        .neq('status', 'draft')
        .neq('status', 'voided');
      if (currencyAccountId) invoicesQ = invoicesQ.eq('currency_account_id', currencyAccountId);
      if (startIso && endIso) invoicesQ = invoicesQ.gte('issue_date', startIso).lte('issue_date', endIso);
      const { data: invoices } = await invoicesQ;

      // 3. Pending inbox count
      const { count: pendingInboxCount } = await supabase
        .from('expense_inbox_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'pending');

      return { expenses: expenses ?? [], invoices: invoices ?? [], pendingInboxCount: pendingInboxCount ?? 0 };
    },
  });

  const report = useMemo<TaxReportData | null>(() => {
    if (!mappings || !query.data) return null;
    const { expenses, invoices, pendingInboxCount } = query.data;

    // Build mapping index: category -> mapping row
    const byCategory = new Map<string, TaxReportMappingRow>();
    for (const m of mappings) byCategory.set(m.expense_category, m);

    // Group by report_line_code
    const linesByCode = new Map<string, TaxReportLine>();
    let totalRaw = 0;
    let totalDeductible = 0;
    let uncategorizedCount = 0;
    let missingVendorCount = 0;
    let inputVat = 0;

    for (const exp of expenses) {
      // Only sum expenses in target currency for now (Phase D will FX-convert)
      if (exp.currency !== currency) continue;
      const amount = Number(exp.amount) || 0;
      const taxAmount = Number(exp.tax_amount) || 0;
      inputVat += taxAmount;

      if (!exp.category) uncategorizedCount += 1;
      if (!exp.vendor_id) missingVendorCount += 1;

      const mapping = byCategory.get(exp.category) ?? byCategory.get('other');
      if (!mapping) continue;

      const deductible = (amount * Number(mapping.deductible_percent)) / 100;
      totalRaw += amount;
      totalDeductible += deductible;

      const existing = linesByCode.get(mapping.report_line_code);
      if (existing) {
        existing.rawTotal += amount;
        existing.deductibleTotal += deductible;
        existing.count += 1;
        if (!existing.categories.includes(exp.category)) existing.categories.push(exp.category);
      } else {
        linesByCode.set(mapping.report_line_code, {
          code: mapping.report_line_code,
          label: mapping.report_line_label,
          sortOrder: mapping.sort_order,
          rawTotal: amount,
          deductibleTotal: deductible,
          count: 1,
          categories: [exp.category],
        });
      }
    }

    const lines = Array.from(linesByCode.values()).sort((a, b) => a.sortOrder - b.sortOrder);

    let vat: TaxReportData['vat'];
    if (jurisdiction === 'EU') {
      let outputVat = 0;
      for (const inv of invoices) {
        if (inv.currency !== currency) continue;
        outputVat += Number(inv.tax_amount) || 0;
      }
      vat = {
        inputVat,
        outputVat,
        netPosition: outputVat - inputVat,
      };
    }

    return {
      jurisdiction,
      currency,
      lines,
      totalRaw,
      totalDeductible,
      vat,
      diagnostics: {
        uncategorizedCount,
        missingVendorCount,
        pendingInboxCount,
      },
    };
  }, [mappings, query.data, currency, jurisdiction]);

  return {
    report,
    isLoading: query.isLoading || !mappings,
    error: query.error,
    refetch: query.refetch,
  };
}
