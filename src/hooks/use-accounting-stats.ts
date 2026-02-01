import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBusiness } from '@/hooks/use-business';

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
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function useAccountingStats(dateRange?: DateRange) {
  const { user } = useAuth();
  const { data: business } = useUserBusiness();

  return useQuery({
    queryKey: ['accounting-stats', business?.id, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<AccountingStats> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const defaultCurrency = business?.default_currency || 'NGN';

      // Fetch invoices
      let invoiceQuery = supabase
        .from('invoices')
        .select('status, total_amount, amount_paid, issued_at');

      if (business) {
        invoiceQuery = invoiceQuery.eq('business_id', business.id);
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

      // Fetch expenses
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date');

      if (business) {
        expenseQuery = expenseQuery.eq('business_id', business.id);
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

      // Calculate Revenue (all non-draft invoices)
      const issuedInvoices = (invoices || []).filter(i => i.status !== 'draft');
      const revenue = issuedInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
      const revenueCount = issuedInvoices.length;

      // Calculate Money In (paid invoices)
      const paidInvoices = (invoices || []).filter(i => i.status === 'paid');
      const moneyIn = paidInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
      const moneyInCount = paidInvoices.length;

      // Calculate Outstanding
      const outstandingInvoices = (invoices || []).filter(i => ['issued', 'sent', 'viewed'].includes(i.status));
      const outstanding = outstandingInvoices.reduce(
        (sum, i) => sum + (Number(i.total_amount) - Number(i.amount_paid || 0)),
        0
      );
      const outstandingCount = outstandingInvoices.length;

      // Calculate Money Out (expenses)
      const moneyOut = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const expenseCount = (expenses || []).length;

      // Calculate What's Left
      const whatsLeft = moneyIn - moneyOut;

      return {
        revenue,
        revenueCount,
        moneyIn,
        moneyInCount,
        outstanding,
        outstandingCount,
        moneyOut,
        expenseCount,
        whatsLeft,
        currency: defaultCurrency,
      };
    },
    enabled: !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
}

// Get expense breakdown by category
export function useExpensesByCategory(dateRange?: DateRange) {
  const { user } = useAuth();
  const { data: business } = useUserBusiness();

  return useQuery({
    queryKey: ['expenses-by-category', business?.id, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('expenses')
        .select('category, amount, expense_date');

      if (business) {
        query = query.eq('business_id', business.id);
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

      // Group by category
      const categoryMap = new Map<string, number>();
      (data || []).forEach(expense => {
        const current = categoryMap.get(expense.category) || 0;
        categoryMap.set(expense.category, current + Number(expense.amount));
      });

      return Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
    },
    enabled: !!user,
  });
}
