import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BillingPayment {
  id: string;
  number: string | null;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  receipt_url: string | null;
}

export function useBillingPayments(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['billing-payments', user?.id],
    queryFn: async (): Promise<BillingPayment[]> => {
      const { data, error } = await supabase.functions.invoke('list-stripe-payments');
      if (error) throw error;
      return (data?.payments ?? []) as BillingPayment[];
    },
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
