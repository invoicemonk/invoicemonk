import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { aggregateAmounts, type CurrencyAmount, type AggregationResult } from '@/lib/currency-aggregation';

export interface CurrencyBreakdownItem {
  total: number;
  count: number;
  hasAllRates: boolean;
}

export interface AccountingStats {
  // Revenue = Sum of invoices with status != 'draft' (issued)
  revenue: number;
  revenueCount: number;
  
  // Money In = Sum of invoices with status = 'paid'
  moneyIn: number;
  moneyInCount: number;
  
  // Outstanding = Revenue - Money In
  outstanding: number;
  outstandingCount: number;
  
  // Money Out = Sum of expenses
  moneyOut: number;
  expenseCount: number;
  
  // What's Left = Money In - Money Out
  whatsLeft: number;
  
  currency: string;
  
  // Multi-currency transparency
  hasMultipleCurrencies: boolean;
  hasUnconvertibleAmounts: boolean;
  excludedInvoiceCount: number;
  excludedExpenseCount: number;
  
  // Currency breakdown for multi-currency visibility
  currencyBreakdown: {
    invoices: Record<string, CurrencyBreakdownItem>;
    expenses: Record<string, CurrencyBreakdownItem>;
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}

function buildBreakdown(result: AggregationResult): Record<string, CurrencyBreakdownItem> {
  const breakdown: Record<string, CurrencyBreakdownItem> = {};
  for (const [currency, data] of Object.entries(result.breakdown)) {
    breakdown[currency] = { 
      total: data.total, 
      count: data.count,
      hasAllRates: data.hasAllRates,
    };
  }
  return breakdown;
}

export function useAccountingStats(businessId?: string, currency?: string, dateRange?: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accounting-stats', businessId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<AccountingStats> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const defaultCurrency = currency || 'NGN';

      // Fetch invoices with exchange rate data
      let invoiceQuery = supabase
        .from('invoices')
        .select('status, total_amount, amount_paid, issued_at, currency, exchange_rate_to_primary');

      if (businessId) {
        invoiceQuery = invoiceQuery.eq('business_id', businessId);
      } else {
        invoiceQuery = invoiceQuery.eq('user_id', user.id);
      }

      // Filter by date range on issued_at
      if (dateRange) {
        invoiceQuery = invoiceQuery
          .gte('issued_at', dateRange.start.toISOString())
          .lte('issued_at', dateRange.end.toISOString());
      }

      const { data: invoices, error: invoiceError } = await invoiceQuery;
      if (invoiceError) throw invoiceError;

      // Fetch expenses with exchange rate data
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date, currency, exchange_rate_to_primary, primary_currency');

      if (businessId) {
        expenseQuery = expenseQuery.eq('business_id', businessId);
      } else {
        expenseQuery = expenseQuery.eq('user_id', user.id);
      }

      // Filter by date range on expense_date
      if (dateRange) {
        expenseQuery = expenseQuery
          .gte('expense_date', dateRange.start.toISOString().split('T')[0])
          .lte('expense_date', dateRange.end.toISOString().split('T')[0]);
      }

      const { data: expenses, error: expenseError } = await expenseQuery;
      if (expenseError) throw expenseError;

      // Build currency amounts for proper aggregation
      const issuedInvoices = (invoices || []).filter(i => i.status !== 'draft');
      const paidInvoices = (invoices || []).filter(i => i.status === 'paid');
      const outstandingInvoices = (invoices || []).filter(i => ['issued', 'sent', 'viewed'].includes(i.status));

      const revenueAmounts: CurrencyAmount[] = issuedInvoices.map(i => ({
        amount: Number(i.total_amount) || 0,
        currency: i.currency || defaultCurrency,
        exchangeRateToPrimary: i.exchange_rate_to_primary,
      }));

      const moneyInAmounts: CurrencyAmount[] = paidInvoices.map(i => ({
        amount: Number(i.total_amount) || 0,
        currency: i.currency || defaultCurrency,
        exchangeRateToPrimary: i.exchange_rate_to_primary,
      }));

      const outstandingAmounts: CurrencyAmount[] = outstandingInvoices.map(i => ({
        amount: (Number(i.total_amount) || 0) - (Number(i.amount_paid) || 0),
        currency: i.currency || defaultCurrency,
        exchangeRateToPrimary: i.exchange_rate_to_primary,
      }));

      const expenseAmounts: CurrencyAmount[] = (expenses || []).map(e => ({
        amount: Number(e.amount) || 0,
        currency: e.currency || defaultCurrency,
        exchangeRateToPrimary: e.exchange_rate_to_primary,
      }));

      // Aggregate with proper currency handling
      const revenueResult = aggregateAmounts(revenueAmounts, defaultCurrency);
      const moneyInResult = aggregateAmounts(moneyInAmounts, defaultCurrency);
      const outstandingResult = aggregateAmounts(outstandingAmounts, defaultCurrency);
      const expenseResult = aggregateAmounts(expenseAmounts, defaultCurrency);

      // Calculate What's Left using properly converted totals
      const whatsLeft = moneyInResult.primaryTotal - expenseResult.primaryTotal;

      // Combine breakdowns
      const invoiceBreakdown = buildBreakdown(revenueResult);
      const expenseBreakdown = buildBreakdown(expenseResult);

      return {
        revenue: revenueResult.primaryTotal,
        revenueCount: revenueResult.convertedCount,
        moneyIn: moneyInResult.primaryTotal,
        moneyInCount: moneyInResult.convertedCount,
        outstanding: outstandingResult.primaryTotal,
        outstandingCount: outstandingResult.convertedCount,
        moneyOut: expenseResult.primaryTotal,
        expenseCount: expenseResult.convertedCount,
        whatsLeft,
        currency: defaultCurrency,
        hasMultipleCurrencies: revenueResult.hasMultipleCurrencies || expenseResult.hasMultipleCurrencies,
        hasUnconvertibleAmounts: revenueResult.hasUnconvertibleAmounts || expenseResult.hasUnconvertibleAmounts,
        excludedInvoiceCount: revenueResult.excludedCount,
        excludedExpenseCount: expenseResult.excludedCount,
        currencyBreakdown: {
          invoices: invoiceBreakdown,
          expenses: expenseBreakdown,
        },
      };
    },
    enabled: !!user,
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
  hasUnconvertibleAmounts: boolean;
  excludedCount: number;
  currency: string;
}

// Get expense breakdown by category with proper currency handling
export function useExpensesByCategory(businessId?: string, dateRange?: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expenses-by-category', businessId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<CategoryBreakdownResult> => {
      if (!user) throw new Error('Not authenticated');

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

      let query = supabase
        .from('expenses')
        .select('category, amount, expense_date, currency, exchange_rate_to_primary');

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (dateRange) {
        query = query
          .gte('expense_date', dateRange.start.toISOString().split('T')[0])
          .lte('expense_date', dateRange.end.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by category with proper currency conversion
      const categoryMap = new Map<string, CurrencyAmount[]>();
      
      (data || []).forEach(expense => {
        const category = expense.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push({
          amount: Number(expense.amount) || 0,
          currency: expense.currency || defaultCurrency,
          exchangeRateToPrimary: expense.exchange_rate_to_primary,
        });
      });

      let totalExcluded = 0;
      let hasUnconvertible = false;

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, amounts]) => {
          const result = aggregateAmounts(amounts, defaultCurrency);
          if (result.hasUnconvertibleAmounts) {
            hasUnconvertible = true;
            totalExcluded += result.excludedCount;
          }
          return { category, amount: result.primaryTotal };
        })
        .sort((a, b) => b.amount - a.amount);

      return {
        data: categoryBreakdown,
        hasUnconvertibleAmounts: hasUnconvertible,
        excludedCount: totalExcluded,
        currency: defaultCurrency,
      };
    },
    enabled: !!user,
  });
}
