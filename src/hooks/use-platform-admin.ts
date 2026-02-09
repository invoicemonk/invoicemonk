import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if the current user is a platform admin.
 * Platform admins have unlimited access to all features and limits.
 * 
 * Queries the user_roles table for the 'platform_admin' role.
 * Cached with long staleTime (10 min) since role changes are rare.
 */
export function usePlatformAdmin() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['platform-admin-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data: hasRole, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'platform_admin',
      });

      if (error) {
        console.error('Platform admin check error:', error);
        return false;
      }

      return !!hasRole;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    isPlatformAdmin: data ?? false,
    loading: isLoading,
  };
}
