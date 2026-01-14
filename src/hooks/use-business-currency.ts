import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessCurrency {
  id: string;
  name: string;
  default_currency: string | null;
  currency_locked: boolean;
  currency_locked_at: string | null;
}

export function useBusinessCurrency(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ['business-currency', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, default_currency, currency_locked, currency_locked_at')
        .eq('id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Business currency fetch error:', error);
        return null;
      }

      return data as BusinessCurrency | null;
    },
    enabled: !!businessId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
