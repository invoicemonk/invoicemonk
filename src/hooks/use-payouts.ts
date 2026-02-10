import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerContext } from '@/contexts/PartnerContext';

export function usePayouts() {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-payouts', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('payout_batches')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });
}
