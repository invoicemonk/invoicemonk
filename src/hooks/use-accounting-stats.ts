import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AccountingStats {
  // Revenue = Sum of total_amount for issued invoices (issued, sent, viewed, paid)
  revenue: number;
  revenueCount: number;
  
  // Money In = Sum of amount_paid across all non-draft, non-voided invoices (supports partial payments)
  moneyIn: number;
  moneyInCount: number; // Count of invoices with any payment recorded
  
  // Outstanding = Sum of (total_amount - amount_paid) for unpaid invoices
  outstanding: number;
  outstandingCount: number;
  
  // Money Out = Sum of expenses
  moneyOut: number;
  expenseCount: number;
  
  // What's Left = Money In - Money Out
  whatsLeft: number;
  
  currency: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Accounting stats strictly scoped by currency account - single currency, no aggregation
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
      if (!user) {
        throw new Error('Not authenticated');
      }

      const defaultCurrency = currency || 'NGN';

      // Fetch invoices - strictly scoped by currency account
      let invoiceQuery = supabase
        .from('invoices')
        .select('status, total_amount, amount_paid, issued_at, currency');

      if (businessId) {
        invoiceQuery = invoiceQuery.eq('business_id', businessId);
      } else {
        invoiceQuery = invoiceQuery.eq('user_id', user.id);
      }

      // Strict currency account filtering
      if (currencyAccountId) {
        invoiceQuery = invoiceQuery.eq('currency_account_id', currencyAccountId);
      }

      // Filter by date range on issued_at
      if (dateRange) {
        invoiceQuery = invoiceQuery
          .gte('issued_at', dateRange.start.toISOString())
          .lte('issued_at', dateRange.end.toISOString());
      }

      const { data: invoices, error: invoiceError } = await invoiceQuery;
      if (invoiceError) throw invoiceError;

      // Fetch expenses - strictly scoped by currency account
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date, currency');

      if (businessId) {
        expenseQuery = expenseQuery.eq('business_id', businessId);
      } else {
        expenseQuery = expenseQuery.eq('user_id', user.id);
      }

      // Strict currency account filtering
      if (currencyAccountId) {
        expenseQuery = expenseQuery.eq('currency_account_id', currencyAccountId);
      }

      // Filter by date range on expense_date
      if (dateRange) {
        expenseQuery = expenseQuery
          .gte('expense_date', dateRange.start.toISOString().split('T')[0])
          .lte('expense_date', dateRange.end.toISOString().split('T')[0]);
      }

      const { data: expenses, error: expenseError } = await expenseQuery;
      if (expenseError) throw expenseError;

      // Log warning if filtering by currency account but invoices might be excluded
      if (currencyAccountId) {
        const invoicesWithoutAccount = (invoices || []).filter(i => i.status !== 'draft');
        if (invoicesWithoutAccount.length === 0) {
          console.warn('[Accounting] No invoices found for currency account filter. Some invoices may have null currency_account_id.');
        }
      }

      // CORRECTED CALCULATIONS:
      
      // Revenue = SUM(total_amount) for issued, sent, viewed, paid (excludes draft and voided)
      const revenueInvoices = (invoices || []).filter(i => 
        ['issued', 'sent', 'viewed', 'paid'].includes(i.status)
      );
      const revenue = revenueInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);

      // Money In = SUM(amount_paid) for all non-draft, non-voided invoices (captures partial payments)
      const nonDraftInvoices = (invoices || []).filter(i => 
        i.status !== 'draft' && i.status !== 'voided'
      );
      const moneyIn = nonDraftInvoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0);
      const moneyInCount = nonDraftInvoices.filter(i => Number(i.amount_paid) > 0).length;

      // Outstanding = SUM(total_amount - amount_paid) for invoices with remaining balance
      const outstandingInvoices = (invoices || []).filter(i => {
        if (!['issued', 'sent', 'viewed'].includes(i.status)) return false;
        const balance = (Number(i.total_amount) || 0) - (Number(i.amount_paid) || 0);
        return balance > 0;
      });
      const outstanding = outstandingInvoices.reduce((sum, i) => 
        sum + ((Number(i.total_amount) || 0) - (Number(i.amount_paid) || 0)), 0);

      // Money Out = SUM(expenses)
      const moneyOut = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      // What's Left = Money In - Money Out
      const whatsLeft = moneyIn - moneyOut;

      return {
        revenue,
        revenueCount: revenueInvoices.length,
        moneyIn,
        moneyInCount,
        outstanding,
        outstandingCount: outstandingInvoices.length,
        moneyOut,
        expenseCount: (expenses || []).length,
        whatsLeft,
        currency: defaultCurrency,
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
  currency: string;
}

// Get expense breakdown by category - strictly scoped by currency account
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

      const defaultCurrency = currency || 'NGN';

      let query = supabase
        .from('expenses')
        .select('category, amount, expense_date, currency');

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      // Strict currency account filtering
      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      if (dateRange) {
        query = query
          .gte('expense_date', dateRange.start.toISOString().split('T')[0])
          .lte('expense_date', dateRange.end.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by category - simple sums, no currency conversion
      const categoryMap = new Map<string, number>();
      
      (data || []).forEach(expense => {
        const category = expense.category;
        const current = categoryMap.get(category) || 0;
        categoryMap.set(category, current + (Number(expense.amount) || 0));
      });

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      return {
        data: categoryBreakdown,
        currency: defaultCurrency,
      };
    },
    enabled: !!user,
  });
}
