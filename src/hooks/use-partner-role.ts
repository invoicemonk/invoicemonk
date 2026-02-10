import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lightweight hook to check if the current user has the 'partner' role.
 * Does not load partner profile or redirect — just a boolean check.
 */
export function usePartnerRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['partner-role-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data: hasRole, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'partner',
      });

      if (error) {
        console.error('Partner role check error:', error);
        return false;
      }

      return !!hasRole;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    isPartner: data ?? false,
    loading: isLoading,
  };
}
