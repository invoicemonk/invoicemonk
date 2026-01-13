import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserOrganization {
  id: string;
  business_id: string;
  role: 'owner' | 'admin' | 'member' | 'auditor';
  business: {
    id: string;
    name: string;
    logo_url: string | null;
    jurisdiction: string;
  };
}

export function useUserOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: async (): Promise<UserOrganization[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('business_members')
        .select(`
          id,
          business_id,
          role,
          business:businesses!inner(
            id,
            name,
            logo_url,
            jurisdiction
          )
        `)
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        business_id: item.business_id,
        role: item.role,
        business: item.business,
      }));
    },
    enabled: !!user?.id,
  });
}
