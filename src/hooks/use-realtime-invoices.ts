import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeInvoices(businessId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Comprehensive invalidation for all financial queries
    const invalidateFinancialQueries = () => {
      // Dashboard queries
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['due-date-stats'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-trend'] });
      // Accounting queries
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-by-category'] });
    };

    // Subscribe to invoice changes
    const invoicesChannel = supabase
      .channel('financial-invoices')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: businessId 
            ? `business_id=eq.${businessId}` 
            : `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Invoice changed:', payload.eventType);
          invalidateFinancialQueries();
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }
      )
      .subscribe();

    // Subscribe to payment changes
    const paymentsChannel = supabase
      .channel('financial-payments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        (payload) => {
          console.log('Payment changed:', payload.eventType);
          invalidateFinancialQueries();
          queryClient.invalidateQueries({ queryKey: ['payments'] });
        }
      )
      .subscribe();

    // Subscribe to expense changes
    const expensesChannel = supabase
      .channel('financial-expenses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: businessId 
            ? `business_id=eq.${businessId}` 
            : `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Expense changed:', payload.eventType);
          invalidateFinancialQueries();
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
      )
      .subscribe();

    // Subscribe to credit note changes
    const creditNotesChannel = supabase
      .channel('financial-credit-notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_notes',
          filter: businessId 
            ? `business_id=eq.${businessId}` 
            : `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Credit note changed:', payload.eventType);
          invalidateFinancialQueries();
          queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(creditNotesChannel);
    };
  }, [businessId, userId, queryClient]);
}
