import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ReportType = 'revenue-summary' | 'invoice-register' | 'tax-report' | 'audit-export';
export type ReportFormat = 'json' | 'csv';

interface ReportRequest {
  report_type: ReportType;
  year: number;
  format?: ReportFormat;
  business_id?: string;
}

interface RevenueSummary {
  period: string;
  total_revenue: number;
  invoice_count: number;
  tax_collected: number;
  currency: string;
}

interface InvoiceRegisterEntry {
  invoice_number: string;
  issue_date: string | null;
  client_name: string;
  total_amount: number;
  tax_amount: number;
  currency: string;
  status: string;
  invoice_hash: string | null;
}

interface TaxReportEntry {
  month: string;
  taxable_amount: number;
  tax_collected: number;
  invoice_count: number;
  currency: string;
}

interface AuditExportEntry {
  timestamp: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  event_hash: string | null;
}

export interface ReportResponse<T = unknown> {
  success: boolean;
  report_type?: string;
  generated_at?: string;
  data?: T[];
  summary?: Record<string, unknown>;
  error?: string;
  upgrade_required?: boolean;
}

async function generateReport<T>(request: ReportRequest): Promise<ReportResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('generate-report', {
    body: request,
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
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
        // For CSV, we need to handle the response differently
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://skcxogeaerudoadluexz.supabase.co'}/functions/v1/generate-report`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3hvZ2VhZXJ1ZG9hZGx1ZXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkyODcsImV4cCI6MjA4Mzg3NTI4N30._G14u4zLW4sTO0VIIgeNideez3vwBuxKAa_ef4rvImc'
            },
            body: JSON.stringify(request)
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate report');
        }

        // Download CSV
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
        toast.success(`${variables.report_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} generated successfully`);
      } else if (data.upgrade_required) {
        toast.error('Upgrade required to access reports');
      } else {
        toast.error(data.error || 'Failed to generate report');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate report');
    }
  });
}

export function useReportStats(year: number, hasReportsAccess: boolean = true) {
  return useQuery({
    queryKey: ['report-stats', year],
    queryFn: async () => {
      // Fetch summary stats for the dashboard
      const response = await generateReport<RevenueSummary>({
        report_type: 'revenue-summary',
        year,
        format: 'json'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch stats');
      }

      return {
        totalRevenue: response.summary?.total_revenue as number || 0,
        totalTax: response.summary?.total_tax as number || 0,
        totalInvoices: response.summary?.total_invoices as number || 0,
        currency: response.summary?.currency as string || 'NGN'
      };
    },
    enabled: hasReportsAccess, // Only fetch if user has reports access
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
}

// Type-safe report generators
export function useRevenueSummaryReport() {
  return useMutation({
    mutationFn: (params: { year: number; format?: ReportFormat }) => 
      generateReport<RevenueSummary>({ 
        report_type: 'revenue-summary', 
        year: params.year,
        format: params.format 
      }),
    onSuccess: () => toast.success('Revenue summary generated'),
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useInvoiceRegisterReport() {
  return useMutation({
    mutationFn: (params: { year: number; format?: ReportFormat }) => 
      generateReport<InvoiceRegisterEntry>({ 
        report_type: 'invoice-register', 
        year: params.year,
        format: params.format 
      }),
    onSuccess: () => toast.success('Invoice register generated'),
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useTaxReport() {
  return useMutation({
    mutationFn: (params: { year: number; format?: ReportFormat }) => 
      generateReport<TaxReportEntry>({ 
        report_type: 'tax-report', 
        year: params.year,
        format: params.format 
      }),
    onSuccess: () => toast.success('Tax report generated'),
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useAuditExportReport() {
  return useMutation({
    mutationFn: (params: { year: number; format?: ReportFormat }) => 
      generateReport<AuditExportEntry>({ 
        report_type: 'audit-export', 
        year: params.year,
        format: params.format 
      }),
    onSuccess: () => toast.success('Audit export generated'),
    onError: (error: Error) => toast.error(error.message)
  });
}
