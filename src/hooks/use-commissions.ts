import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerContext } from '@/contexts/PartnerContext';

export function useCommissions(statusFilter?: string) {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-commissions', partner?.id, statusFilter],
    queryFn: async () => {
      if (!partner?.id) return [];
      let query = supabase
        .from('commissions')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pending' | 'locked' | 'paid' | 'voided');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });
}

export interface EarningsByCurrency {
  currency: string;
  pending: number;
  locked: number;
  paid: number;
  total: number;
}

export function useEarningsByCurrency() {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-earnings-by-currency', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('commissions')
        .select('currency, status, commission_amount')
        .eq('partner_id', partner.id);

      if (error) throw error;

      const map: Record<string, EarningsByCurrency> = {};
      for (const row of data || []) {
        if (!map[row.currency]) {
          map[row.currency] = { currency: row.currency, pending: 0, locked: 0, paid: 0, total: 0 };
        }
        const amt = Number(row.commission_amount);
        map[row.currency].total += amt;
        if (row.status === 'pending') map[row.currency].pending += amt;
        else if (row.status === 'locked') map[row.currency].locked += amt;
        else if (row.status === 'paid') map[row.currency].paid += amt;
      }

      return Object.values(map);
    },
    enabled: !!partner?.id,
  });
}
