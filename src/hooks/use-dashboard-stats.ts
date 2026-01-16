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

export function useDashboardStats(businessId: string | undefined, dateRange?: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats', businessId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DashboardStats> => {
      if (!user?.id) {
        return {
          totalRevenue: 0,
          outstanding: 0,
          paidThisMonth: 0,
          draftCount: 0,
          currency: 'USD',
          outstandingCount: 0,
          paidThisMonthCount: 0,
        };
      }

      // Build query based on whether we have a business or user context
      let query = supabase
        .from('invoices')
        .select('status, total_amount, currency, issued_at, amount_paid');

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      // Apply date range filter for issued invoices
      if (dateRange) {
        query = query.gte('issued_at', dateRange.start.toISOString())
                     .lte('issued_at', dateRange.end.toISOString());
      }

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw error;
      }

      // Get business currency
      let defaultCurrency = 'USD';
      if (businessId) {
        const { data: business } = await supabase
          .from('businesses')
          .select('default_currency')
          .eq('id', businessId)
          .single();
        
        if (business?.default_currency) {
          defaultCurrency = business.default_currency;
        }
      }

      // Calculate stats - when date range is set, use it; otherwise use current month
      const now = new Date();
      const startOfMonth = dateRange?.start || new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = dateRange?.end || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const paidInvoices = invoices?.filter(i => i.status === 'paid') || [];
      const outstandingInvoices = invoices?.filter(i => ['issued', 'sent', 'viewed'].includes(i.status)) || [];
      const draftInvoices = invoices?.filter(i => i.status === 'draft') || [];
      
      const paidThisMonthInvoices = paidInvoices.filter(i => {
        if (!i.issued_at) return false;
        const issuedDate = new Date(i.issued_at);
        return issuedDate >= startOfMonth && issuedDate <= endOfMonth;
      });

      return {
        totalRevenue: paidInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0),
        outstanding: outstandingInvoices.reduce((sum, i) => sum + (Number(i.total_amount) - Number(i.amount_paid || 0)), 0),
        paidThisMonth: paidThisMonthInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0),
        draftCount: draftInvoices.length,
        currency: defaultCurrency,
        outstandingCount: outstandingInvoices.length,
        paidThisMonthCount: paidThisMonthInvoices.length,
      };
    },
    enabled: !!user?.id,
  });
}

interface RevenueTrendPoint {
  month: string;
  revenue: number;
  invoiceCount: number;
}

export function useRevenueTrend(businessId: string | undefined, months = 12) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['revenue-trend', businessId, user?.id, months],
    refetchInterval: 60000,
    queryFn: async (): Promise<RevenueTrendPoint[]> => {
      if (!user?.id) return [];

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      let query = supabase
        .from('invoices')
        .select('total_amount, issued_at')
        .eq('status', 'paid')
        .gte('issued_at', startDate.toISOString());

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: invoices, error } = await query;
      
      if (error) {
        console.error('Error fetching revenue trend:', error);
        throw error;
      }

      // Create buckets for each month
      const monthBuckets: Map<string, { revenue: number; count: number }> = new Map();
      
      // Initialize all months with zero
      for (let i = 0; i < months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (months - 1 - i));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets.set(key, { revenue: 0, count: 0 });
      }

      // Aggregate invoice data by month
      (invoices || []).forEach(invoice => {
        if (!invoice.issued_at) return;
        const date = new Date(invoice.issued_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const bucket = monthBuckets.get(key);
        if (bucket) {
          bucket.revenue += Number(invoice.total_amount) || 0;
          bucket.count += 1;
        }
      });

      // Convert to array with formatted month names
      return Array.from(monthBuckets.entries()).map(([key, data]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          revenue: data.revenue,
          invoiceCount: data.count,
        };
      });
    },
    enabled: !!user?.id,
  });
}

export function useRecentInvoices(businessId: string | undefined, limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-invoices', businessId, user?.id, limit],
    refetchInterval: 30000, // Refetch every 30 seconds
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

export function useDueDateStats(businessId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['due-date-stats', businessId, user?.id],
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DueDateStats> => {
      if (!user?.id) {
        return {
          overdueCount: 0,
          overdueAmount: 0,
          upcomingCount: 0,
          upcomingAmount: 0,
          currency: 'USD',
        };
      }

      // Get outstanding invoices with due dates
      let query = supabase
        .from('invoices')
        .select('id, due_date, total_amount, amount_paid, currency, status')
        .in('status', ['issued', 'sent', 'viewed'])
        .not('due_date', 'is', null);

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching due date stats:', error);
        throw error;
      }

      // Get business currency
      let defaultCurrency = 'USD';
      if (businessId) {
        const { data: business } = await supabase
          .from('businesses')
          .select('default_currency')
          .eq('id', businessId)
          .single();
        
        if (business?.default_currency) {
          defaultCurrency = business.default_currency;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      let overdueCount = 0;
      let overdueAmount = 0;
      let upcomingCount = 0;
      let upcomingAmount = 0;

      (invoices || []).forEach(invoice => {
        if (!invoice.due_date) return;
        
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const outstanding = Number(invoice.total_amount) - Number(invoice.amount_paid || 0);
        
        if (dueDate < today) {
          // Overdue
          overdueCount++;
          overdueAmount += outstanding;
        } else if (dueDate <= sevenDaysFromNow) {
          // Due within 7 days
          upcomingCount++;
          upcomingAmount += outstanding;
        }
      });

      return {
        overdueCount,
        overdueAmount,
        upcomingCount,
        upcomingAmount,
        currency: defaultCurrency,
      };
    },
    enabled: !!user?.id,
  });
}
