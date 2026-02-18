import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DateRange {
  start: Date;
  end: Date;
}

export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['recent-invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['due-date-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['revenue-trend'] }),
    ]);
    setIsRefreshing(false);
  }, [queryClient]);

  return { refresh, isRefreshing };
}

interface DashboardStats {
  totalRevenue: number;
  outstanding: number;
  paidThisMonth: number;
  draftCount: number;
  currency: string;
  outstandingCount: number;
  paidThisMonthCount: number;
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  currency: string;
  status: string;
  issue_date: string | null;
  created_at: string;
}

// Dashboard stats via server-side RPC - no row limit issues
export function useDashboardStats(
  businessId: string | undefined, 
  currencyAccountId: string | undefined,
  currency: string,
  dateRange?: DateRange
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats', businessId, currencyAccountId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DashboardStats> => {
      if (!user?.id || !businessId) {
        return {
          totalRevenue: 0,
          outstanding: 0,
          paidThisMonth: 0,
          draftCount: 0,
          currency,
          outstandingCount: 0,
          paidThisMonthCount: 0,
        };
      }

      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        _business_id: businessId,
        _currency_account_id: currencyAccountId || null,
        _date_start: dateRange?.start?.toISOString() || null,
        _date_end: dateRange?.end?.toISOString() || null,
      });

      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw error;
      }

      const result = data as Record<string, unknown>;

      return {
        totalRevenue: Number(result.total_revenue) || 0,
        outstanding: Number(result.outstanding) || 0,
        paidThisMonth: Number(result.paid_this_month) || 0,
        draftCount: Number(result.draft_count) || 0,
        currency: (result.currency as string) || currency,
        outstandingCount: Number(result.outstanding_count) || 0,
        paidThisMonthCount: Number(result.paid_this_month_count) || 0,
      };
    },
    enabled: !!user?.id && !!businessId,
  });
}

interface RevenueTrendPoint {
  month: string;
  revenue: number;
  invoiceCount: number;
}

interface RevenueTrendResult {
  data: RevenueTrendPoint[];
  currency: string;
}

// Revenue trend via server-side RPC
export function useRevenueTrend(
  businessId: string | undefined, 
  currencyAccountId: string | undefined,
  currency: string,
  months = 12
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['revenue-trend', businessId, currencyAccountId, user?.id, months],
    refetchInterval: 60000,
    queryFn: async (): Promise<RevenueTrendResult> => {
      if (!user?.id || !businessId) return { data: [], currency };

      const { data, error } = await supabase.rpc('get_revenue_trend', {
        _business_id: businessId,
        _currency_account_id: currencyAccountId || null,
        _months: months,
      });

      if (error) {
        console.error('Error fetching revenue trend:', error);
        throw error;
      }

      const trendData = (data as Array<{ month: string; revenue: number; invoice_count: number }> || []).map(row => ({
        month: row.month,
        revenue: Number(row.revenue) || 0,
        invoiceCount: Number(row.invoice_count) || 0,
      }));

      return { data: trendData, currency };
    },
    enabled: !!user?.id && !!businessId,
  });
}

export function useRecentInvoices(
  businessId: string | undefined, 
  currencyAccountId: string | undefined,
  limit = 5
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-invoices', businessId, currencyAccountId, user?.id, limit],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<RecentInvoice[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          currency,
          status,
          issue_date,
          created_at,
          clients!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recent invoices:', error);
        throw error;
      }

      return (data || []).map(invoice => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: (invoice.clients as any)?.name || 'Unknown Client',
        total_amount: Number(invoice.total_amount),
        currency: invoice.currency,
        status: invoice.status,
        issue_date: invoice.issue_date,
        created_at: invoice.created_at,
      }));
    },
    enabled: !!user?.id,
  });
}

interface DueDateStats {
  overdueCount: number;
  overdueAmount: number;
  upcomingCount: number;
  upcomingAmount: number;
  currency: string;
}

// Due date stats via server-side RPC
export function useDueDateStats(
  businessId: string | undefined,
  currencyAccountId: string | undefined,
  currency: string
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['due-date-stats', businessId, currencyAccountId, user?.id],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DueDateStats> => {
      if (!user?.id || !businessId) {
        return {
          overdueCount: 0,
          overdueAmount: 0,
          upcomingCount: 0,
          upcomingAmount: 0,
          currency,
        };
      }

      const { data, error } = await supabase.rpc('get_due_date_stats', {
        _business_id: businessId,
        _currency_account_id: currencyAccountId || null,
      });

      if (error) {
        console.error('Error fetching due date stats:', error);
        throw error;
      }

      const result = data as Record<string, unknown>;

      return {
        overdueCount: Number(result.overdue_count) || 0,
        overdueAmount: Number(result.overdue_amount) || 0,
        upcomingCount: Number(result.upcoming_count) || 0,
        upcomingAmount: Number(result.upcoming_amount) || 0,
        currency: (result.currency as string) || currency,
      };
    },
    enabled: !!user?.id && !!businessId,
  });
}