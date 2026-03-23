import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CashflowSummary {
  inflow: number;
  outflow: number;
  net_cashflow: number;
  prev_inflow: number;
  prev_outflow: number;
  prev_net_cashflow: number;
  inflow_change_pct: number | null;
  outflow_change_pct: number | null;
  net_change_pct: number | null;
  period_start: string;
  period_end: string;
}

export interface AgingBuckets {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
}

export interface SlowPayer {
  client_id: string;
  client_name: string;
  avg_days_to_pay: number;
  outstanding_amount: number;
  invoice_count: number;
}

export interface ReceivablesIntelligence {
  total_outstanding: number;
  overdue_amount: number;
  aging: AgingBuckets;
  slow_payers: SlowPayer[];
}

export interface ExpenseCategory {
  category: string;
  total: number;
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ProfitabilityStats {
  gross_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin_pct: number;
  expense_breakdown: ExpenseCategory[];
  monthly_trend: MonthlyTrend[];
  period_start: string;
  period_end: string;
}

export function useCashflowSummary(
  businessId: string | undefined,
  currencyAccountId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cashflow-summary', businessId, currencyAccountId, startDate, endDate],
    queryFn: async (): Promise<CashflowSummary> => {
      const { data, error } = await supabase.rpc('get_cashflow_summary', {
        _business_id: businessId!,
        _currency_account_id: currencyAccountId || null,
        _start_date: startDate || null,
        _end_date: endDate || null,
      });

      if (error) throw error;
      return data as unknown as CashflowSummary;
    },
    enabled: !!user?.id && !!businessId,
    refetchInterval: 60000,
  });
}

export function useReceivablesIntelligence(
  businessId: string | undefined,
  currencyAccountId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['receivables-intelligence', businessId, currencyAccountId, startDate, endDate],
    queryFn: async (): Promise<ReceivablesIntelligence> => {
      const { data, error } = await supabase.rpc('get_receivables_intelligence', {
        _business_id: businessId!,
        _currency_account_id: currencyAccountId || null,
        _start_date: startDate || null,
        _end_date: endDate || null,
      });

      if (error) throw error;
      return data as unknown as ReceivablesIntelligence;
    },
    enabled: !!user?.id && !!businessId,
    refetchInterval: 60000,
  });
}

export function useProfitabilityStats(
  businessId: string | undefined,
  currencyAccountId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profitability-stats', businessId, currencyAccountId, startDate, endDate],
    queryFn: async (): Promise<ProfitabilityStats> => {
      const { data, error } = await supabase.rpc('get_profitability_stats', {
        _business_id: businessId!,
        _currency_account_id: currencyAccountId || null,
        _start_date: startDate || null,
        _end_date: endDate || null,
      });

      if (error) throw error;
      return data as unknown as ProfitabilityStats;
    },
    enabled: !!user?.id && !!businessId,
    refetchInterval: 60000,
  });
}
