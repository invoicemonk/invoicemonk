import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ReportType =
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
  | 'tax-report'
  | 'audit-export'
  | 'export-history';

export type ReportFormat = 'json' | 'csv';

export type ReportCategory = 'revenue' | 'receipts' | 'expenses' | 'accounting' | 'compliance';

interface ReportRequest {
  report_type: ReportType;
  year: number;
  format?: ReportFormat;
  business_id?: string;
  currency_account_id?: string;
}

export interface ReportResponse<T = unknown> {
  success: boolean;
  report_type?: string;
  generated_at?: string;
  currency?: string;
  currency_account_id?: string;
  data?: T[] | T;
  summary?: Record<string, unknown>;
  error?: string;
  upgrade_required?: boolean;
}

export interface ReportDefinition {
  id: ReportType;
  title: string;
  description: string;
  category: ReportCategory;
  requiresCurrencyAccount: boolean;
  exportable: boolean;
  requiredTier: 'starter' | 'professional' | 'business';
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // Revenue
  { id: 'invoice-register', title: 'Invoice Register', description: 'All issued invoices with payment & credit note status', category: 'revenue', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  { id: 'revenue-by-period', title: 'Revenue by Period', description: 'Monthly revenue breakdown', category: 'revenue', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  { id: 'revenue-by-client', title: 'Revenue by Client', description: 'Top clients by invoiced amount', category: 'revenue', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  { id: 'outstanding-report', title: 'Outstanding Report', description: 'Invoices with unpaid balances', category: 'revenue', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  // Receipts
  { id: 'receipt-register', title: 'Receipt Register', description: 'All receipts with verification status', category: 'receipts', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  // Expenses
  { id: 'expense-register', title: 'Expense Register', description: 'All expenses for the currency account', category: 'expenses', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  { id: 'expense-by-category', title: 'Expenses by Category', description: 'Category-level expense breakdown', category: 'expenses', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  { id: 'expense-by-vendor', title: 'Expenses by Vendor', description: 'Vendor-level expense breakdown', category: 'expenses', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  // Accounting
  { id: 'income-statement', title: 'Income Statement (P&L)', description: 'Revenue minus expenses for the period', category: 'accounting', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  { id: 'cash-flow-summary', title: 'Cash Flow Summary', description: 'Cash inflow vs outflow with net position', category: 'accounting', requiresCurrencyAccount: true, exportable: true, requiredTier: 'professional' },
  // Compliance
  { id: 'tax-report', title: 'Tax Report', description: 'Tax collected by period with credit note adjustments', category: 'compliance', requiresCurrencyAccount: true, exportable: true, requiredTier: 'business' },
  { id: 'audit-export', title: 'Audit Export', description: 'Full audit trail with state snapshots', category: 'compliance', requiresCurrencyAccount: false, exportable: true, requiredTier: 'business' },
  { id: 'export-history', title: 'Export History', description: 'History of all data exports', category: 'compliance', requiresCurrencyAccount: false, exportable: false, requiredTier: 'business' },
];

export const REPORT_CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'compliance', label: 'Compliance' },
];

async function generateReport<T>(request: ReportRequest): Promise<ReportResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('generate-report', {
    body: request,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to generate report');
  }

  return response.data as ReportResponse<T>;
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: async (request: ReportRequest) => {
      if (request.format === 'csv') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(
          'https://skcxogeaerudoadluexz.supabase.co/functions/v1/generate-report',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc',
            },
            body: JSON.stringify(request),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate report');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${request.report_type}-${request.year}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        return { success: true } as ReportResponse;
      }

      return generateReport(request);
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(`${variables.report_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} generated`);
      } else if (data.upgrade_required) {
        toast.error('Upgrade required to access this report');
      } else {
        toast.error(data.error || 'Failed to generate report');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate report');
    },
  });
}

// Hook to fetch audit events count for a given year
export function useAuditEventsCount(year: number) {
  return useQuery({
    queryKey: ['audit-events-count', year],
    queryFn: async () => {
      const startOfYear = new Date(year, 0, 1).toISOString();
      const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString();

      const { count, error } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp_utc', startOfYear)
        .lte('timestamp_utc', endOfYear);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
