import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RetentionPolicy {
  id: string;
  entity_type: string;
  jurisdiction: string;
  retention_years: number;
  legal_basis: string | null;
  created_at: string | null;
}

export function useRetentionPolicies(jurisdiction?: string) {
  return useQuery({
    queryKey: ['retention-policies', jurisdiction],
    queryFn: async (): Promise<RetentionPolicy[]> => {
      let query = supabase
        .from('retention_policies')
        .select('*')
        .order('entity_type');

      if (jurisdiction) {
        query = query.eq('jurisdiction', jurisdiction);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
}

export function useRetentionPoliciesByJurisdiction(jurisdiction: string) {
  return useQuery({
    queryKey: ['retention-policies', jurisdiction],
    queryFn: async (): Promise<RetentionPolicy[]> => {
      const { data, error } = await supabase
        .from('retention_policies')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .order('entity_type');

      if (error) throw error;
      return data || [];
    },
    enabled: !!jurisdiction,
  });
}
