import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useVendorSuggestions(businessId?: string, currencyAccountId?: string) {
  return useQuery({
    queryKey: ['vendor-suggestions', businessId, currencyAccountId],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('vendor')
        .not('vendor', 'is', null)
        .neq('vendor', '');

      if (businessId) query = query.eq('business_id', businessId);
      if (currencyAccountId) query = query.eq('currency_account_id', currencyAccountId);

      const { data, error } = await query;
      if (error) throw error;

      const unique = [...new Set((data || []).map(d => d.vendor).filter(Boolean) as string[])];
      return unique.sort((a, b) => a.localeCompare(b));
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });
}
