import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AccountingStats {
  revenue: number;
  revenueCount: number;
  moneyIn: number;
  moneyInCount: number;
  outstanding: number;
  outstandingCount: number;
  moneyOut: number;
  expenseCount: number;
  whatsLeft: number;
  currency: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Accounting stats via server-side RPC - no row limit issues
export function useAccountingStats(
  businessId?: string, 
  currencyAccountId?: string,
  currency?: string, 
  dateRange?: DateRange
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accounting-stats', businessId, currencyAccountId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<AccountingStats> => {
      if (!user) throw new Error('Not authenticated');
      if (!businessId) throw new Error('No business ID');

      const defaultCurrency = currency || '';

      const { data, error } = await supabase.rpc('get_accounting_stats', {
        _business_id: businessId,
        _currency_account_id: currencyAccountId || null,
        _date_start: dateRange?.start?.toISOString() || null,
        _date_end: dateRange?.end?.toISOString() || null,
      });

      if (error) throw error;

      const result = data as Record<string, unknown>;

      return {
        revenue: Number(result.revenue) || 0,
        revenueCount: Number(result.revenue_count) || 0,
        moneyIn: Number(result.money_in) || 0,
        moneyInCount: Number(result.money_in_count) || 0,
        outstanding: Number(result.outstanding) || 0,
        outstandingCount: Number(result.outstanding_count) || 0,
        moneyOut: Number(result.money_out) || 0,
        expenseCount: Number(result.expense_count) || 0,
        whatsLeft: Number(result.whats_left) || 0,
        currency: (result.currency as string) || defaultCurrency,
      };
    },
    enabled: !!user && !!businessId,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
}

export interface CategoryBreakdownResult {
  data: CategoryBreakdownItem[];
  currency: string;
}

// Expense breakdown via server-side RPC
export function useExpensesByCategory(
  businessId?: string, 
  currencyAccountId?: string,
  currency?: string,
  dateRange?: DateRange
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expenses-by-category', businessId, currencyAccountId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<CategoryBreakdownResult> => {
      if (!user) throw new Error('Not authenticated');
      if (!businessId) throw new Error('No business ID');

      const defaultCurrency = currency || '';

      const { data, error } = await supabase.rpc('get_expenses_by_category', {
        _business_id: businessId,
        _currency_account_id: currencyAccountId || null,
        _date_start: dateRange?.start?.toISOString() || null,
        _date_end: dateRange?.end?.toISOString() || null,
      });

      if (error) throw error;

      const categoryBreakdown = (data as Array<{ category: string; amount: number }> || []).map(row => ({
        category: row.category,
        amount: Number(row.amount) || 0,
      }));

      return {
        data: categoryBreakdown,
        currency: defaultCurrency,
      };
    },
    enabled: !!user && !!businessId,
  });
}