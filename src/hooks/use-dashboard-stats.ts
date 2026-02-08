import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { aggregateAmounts, type CurrencyAmount, type AggregationResult } from '@/lib/currency-aggregation';

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

export interface CurrencyBreakdownItem {
  total: number;
  count: number;
}

interface DashboardStats {
  totalRevenue: number;
  outstanding: number;
  paidThisMonth: number;
  draftCount: number;
  currency: string;
  outstandingCount: number;
  paidThisMonthCount: number;
  // Multi-currency fields
  hasMultipleCurrencies: boolean;
  hasUnconvertibleAmounts: boolean;
  revenueBreakdown: Record<string, CurrencyBreakdownItem>;
  outstandingBreakdown: Record<string, CurrencyBreakdownItem>;
  paidThisMonthBreakdown: Record<string, CurrencyBreakdownItem>;
  excludedFromRevenue: number;
  excludedFromOutstanding: number;
  excludedFromPaidThisMonth: number;
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

function buildBreakdown(result: AggregationResult): Record<string, CurrencyBreakdownItem> {
  const breakdown: Record<string, CurrencyBreakdownItem> = {};
  for (const [currency, data] of Object.entries(result.breakdown)) {
    breakdown[currency] = { total: data.total, count: data.count };
  }
  return breakdown;
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
          currency: 'NGN',
          outstandingCount: 0,
          paidThisMonthCount: 0,
          hasMultipleCurrencies: false,
          hasUnconvertibleAmounts: false,
          revenueBreakdown: {},
          outstandingBreakdown: {},
          paidThisMonthBreakdown: {},
          excludedFromRevenue: 0,
          excludedFromOutstanding: 0,
          excludedFromPaidThisMonth: 0,
        };
      }

      // Build query with exchange rate data
      let query = supabase
        .from('invoices')
        .select('status, total_amount, currency, issued_at, amount_paid, exchange_rate_to_primary');

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
      let defaultCurrency = 'NGN';
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

      // Calculate stats with proper currency aggregation
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

      // Build currency amounts for proper aggregation
      const revenueAmounts: CurrencyAmount[] = paidInvoices.map(i => ({
        amount: Number(i.total_amount) || 0,
        currency: i.currency || defaultCurrency,
        exchangeRateToPrimary: i.exchange_rate_to_primary,
      }));

      const outstandingAmounts: CurrencyAmount[] = outstandingInvoices.map(i => ({
        amount: (Number(i.total_amount) || 0) - (Number(i.amount_paid) || 0),
        currency: i.currency || defaultCurrency,
        exchangeRateToPrimary: i.exchange_rate_to_primary,
      }));

      const paidThisMonthAmounts: CurrencyAmount[] = paidThisMonthInvoices.map(i => ({
        amount: Number(i.total_amount) || 0,
        currency: i.currency || defaultCurrency,
        exchangeRateToPrimary: i.exchange_rate_to_primary,
      }));

      // Aggregate with proper currency handling
      const revenueResult = aggregateAmounts(revenueAmounts, defaultCurrency);
      const outstandingResult = aggregateAmounts(outstandingAmounts, defaultCurrency);
      const paidThisMonthResult = aggregateAmounts(paidThisMonthAmounts, defaultCurrency);

      return {
        totalRevenue: revenueResult.primaryTotal,
        outstanding: outstandingResult.primaryTotal,
        paidThisMonth: paidThisMonthResult.primaryTotal,
        draftCount: draftInvoices.length,
        currency: defaultCurrency,
        outstandingCount: outstandingInvoices.length,
        paidThisMonthCount: paidThisMonthInvoices.length,
        hasMultipleCurrencies: revenueResult.hasMultipleCurrencies || outstandingResult.hasMultipleCurrencies,
        hasUnconvertibleAmounts: revenueResult.hasUnconvertibleAmounts || outstandingResult.hasUnconvertibleAmounts || paidThisMonthResult.hasUnconvertibleAmounts,
        revenueBreakdown: buildBreakdown(revenueResult),
        outstandingBreakdown: buildBreakdown(outstandingResult),
        paidThisMonthBreakdown: buildBreakdown(paidThisMonthResult),
        excludedFromRevenue: revenueResult.excludedCount,
        excludedFromOutstanding: outstandingResult.excludedCount,
        excludedFromPaidThisMonth: paidThisMonthResult.excludedCount,
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

interface RevenueTrendResult {
  data: RevenueTrendPoint[];
  hasExcludedData: boolean;
  excludedCount: number;
  currency: string;
}

export function useRevenueTrend(businessId: string | undefined, months = 12) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['revenue-trend', businessId, user?.id, months],
    refetchInterval: 60000,
    queryFn: async (): Promise<RevenueTrendResult> => {
      if (!user?.id) return { data: [], hasExcludedData: false, excludedCount: 0, currency: 'NGN' };

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      // Get business currency first
      let defaultCurrency = 'NGN';
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

      let query = supabase
        .from('invoices')
        .select('total_amount, issued_at, currency, exchange_rate_to_primary')
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
      const monthBuckets: Map<string, { amounts: CurrencyAmount[] }> = new Map();
      
      // Initialize all months
      for (let i = 0; i < months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (months - 1 - i));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets.set(key, { amounts: [] });
      }

      // Track excluded invoices
      let totalExcluded = 0;

      // Aggregate invoice data by month
      (invoices || []).forEach(invoice => {
        if (!invoice.issued_at) return;
        const date = new Date(invoice.issued_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const bucket = monthBuckets.get(key);
        if (bucket) {
          const currency = invoice.currency || defaultCurrency;
          const canConvert = currency === defaultCurrency || 
            (invoice.exchange_rate_to_primary && invoice.exchange_rate_to_primary > 0);
          
          if (canConvert) {
            bucket.amounts.push({
              amount: Number(invoice.total_amount) || 0,
              currency,
              exchangeRateToPrimary: invoice.exchange_rate_to_primary,
            });
          } else {
            totalExcluded++;
          }
        }
      });

      // Convert to array with proper aggregation
      const trendData = Array.from(monthBuckets.entries()).map(([key, bucket]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const aggregated = aggregateAmounts(bucket.amounts, defaultCurrency);
        
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          revenue: aggregated.primaryTotal,
          invoiceCount: aggregated.convertedCount,
        };
      });

      return {
        data: trendData,
        hasExcludedData: totalExcluded > 0,
        excludedCount: totalExcluded,
        currency: defaultCurrency,
      };
    },
    enabled: !!user?.id,
  });
}

export function useRecentInvoices(businessId: string | undefined, limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-invoices', businessId, user?.id, limit],
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
  hasMultipleCurrencies: boolean;
  hasUnconvertibleAmounts: boolean;
  overdueBreakdown: Record<string, CurrencyBreakdownItem>;
  upcomingBreakdown: Record<string, CurrencyBreakdownItem>;
  excludedOverdue: number;
  excludedUpcoming: number;
}

export function useDueDateStats(businessId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['due-date-stats', businessId, user?.id],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DueDateStats> => {
      if (!user?.id) {
        return {
          overdueCount: 0,
          overdueAmount: 0,
          upcomingCount: 0,
          upcomingAmount: 0,
          currency: 'NGN',
          hasMultipleCurrencies: false,
          hasUnconvertibleAmounts: false,
          overdueBreakdown: {},
          upcomingBreakdown: {},
          excludedOverdue: 0,
          excludedUpcoming: 0,
        };
      }

      // Get outstanding invoices with due dates and exchange rates
      let query = supabase
        .from('invoices')
        .select('id, due_date, total_amount, amount_paid, currency, status, exchange_rate_to_primary')
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
      let defaultCurrency = 'NGN';
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

      const overdueAmounts: CurrencyAmount[] = [];
      const upcomingAmounts: CurrencyAmount[] = [];

      (invoices || []).forEach(invoice => {
        if (!invoice.due_date) return;
        
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const outstanding = Number(invoice.total_amount) - Number(invoice.amount_paid || 0);
        const currencyAmount: CurrencyAmount = {
          amount: outstanding,
          currency: invoice.currency || defaultCurrency,
          exchangeRateToPrimary: invoice.exchange_rate_to_primary,
        };
        
        if (dueDate < today) {
          overdueAmounts.push(currencyAmount);
        } else if (dueDate <= sevenDaysFromNow) {
          upcomingAmounts.push(currencyAmount);
        }
      });

      const overdueResult = aggregateAmounts(overdueAmounts, defaultCurrency);
      const upcomingResult = aggregateAmounts(upcomingAmounts, defaultCurrency);

      return {
        overdueCount: overdueResult.totalCount,
        overdueAmount: overdueResult.primaryTotal,
        upcomingCount: upcomingResult.totalCount,
        upcomingAmount: upcomingResult.primaryTotal,
        currency: defaultCurrency,
        hasMultipleCurrencies: overdueResult.hasMultipleCurrencies || upcomingResult.hasMultipleCurrencies,
        hasUnconvertibleAmounts: overdueResult.hasUnconvertibleAmounts || upcomingResult.hasUnconvertibleAmounts,
        overdueBreakdown: buildBreakdown(overdueResult),
        upcomingBreakdown: buildBreakdown(upcomingResult),
        excludedOverdue: overdueResult.excludedCount,
        excludedUpcoming: upcomingResult.excludedCount,
      };
    },
    enabled: !!user?.id,
  });
}
