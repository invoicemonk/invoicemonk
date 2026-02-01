import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Redirects the user to their default/first business dashboard.
 * Used when accessing /dashboard without a business context.
 */
export function BusinessRedirect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: defaultBusinessId, isLoading } = useQuery({
    queryKey: ['default-business', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // First try to find the user's default business
      const { data: defaultMembership, error: defaultError } = await supabase
        .from('business_members')
        .select(`
          business_id,
          business:businesses!inner(id, is_default)
        `)
        .eq('user_id', user.id)
        .eq('businesses.is_default', true)
        .limit(1)
        .maybeSingle();

      if (!defaultError && defaultMembership?.business_id) {
        return defaultMembership.business_id;
      }

      // If no default, get the first business
      const { data: firstMembership, error: firstError } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstError && firstMembership?.business_id) {
        return firstMembership.business_id;
      }

      return null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading || isLoading) return;

    if (defaultBusinessId) {
      navigate(`/b/${defaultBusinessId}/dashboard`, { replace: true });
    } else {
      // User has no business - this shouldn't happen with the new trigger,
      // but handle it gracefully by redirecting to business profile setup
      navigate('/business-profile', { replace: true });
    }
  }, [defaultBusinessId, authLoading, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
