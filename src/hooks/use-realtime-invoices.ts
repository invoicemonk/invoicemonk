import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeInvoices(businessId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidateDashboardQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['due-date-stats'] });
    };

    // Subscribe to invoice changes
    const invoicesChannel = supabase
      .channel('dashboard-invoices')
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
          invalidateDashboardQueries();
        }
      )
      .subscribe();

    // Subscribe to payment changes for accurate outstanding amounts
    const paymentsChannel = supabase
      .channel('dashboard-payments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        (payload) => {
          console.log('Payment changed:', payload.eventType);
          invalidateDashboardQueries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [businessId, userId, queryClient]);
}
