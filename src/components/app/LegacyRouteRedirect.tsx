import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redirects legacy routes (e.g., /invoices) to business-scoped routes (e.g., /b/:businessId/invoices)
 * Falls back to the default business or first available business.
 */
export function LegacyRouteRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['user-businesses-redirect', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('business_members')
        .select(`
          business_id,
          business:businesses(id, is_default)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (isLoading || !businesses) return;

    // Find default or first business
    const defaultBusiness = businesses.find((m: any) => m.business?.is_default);
    const targetBusiness = defaultBusiness || businesses[0];

    if (targetBusiness) {
      const businessId = targetBusiness.business_id;
      // Get the current path after root (e.g., /invoices -> invoices)
      const currentPath = location.pathname;
      const newPath = `/b/${businessId}${currentPath}`;
      navigate(newPath, { replace: true });
    } else {
      // No business found - redirect to dashboard which will handle onboarding
      navigate('/dashboard', { replace: true });
    }
  }, [businesses, isLoading, navigate, location.pathname]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
