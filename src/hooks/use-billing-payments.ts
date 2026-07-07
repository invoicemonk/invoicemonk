import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonationOptional } from '@/contexts/ImpersonationContext';

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
  const { target } = useImpersonationOptional();
  const effectiveUserId = target?.userId || user?.id;
  return useQuery({
    queryKey: ['billing-payments', effectiveUserId, target ? 'imp' : 'self'],
    queryFn: async (): Promise<BillingPayment[]> => {
      const { data, error } = await supabase.functions.invoke('list-stripe-payments', {
        body: target ? { target_user_id: target.userId } : {},
      });
      if (error) throw error;
      return (data?.payments ?? []) as BillingPayment[];
    },
    enabled: enabled && !!effectiveUserId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
