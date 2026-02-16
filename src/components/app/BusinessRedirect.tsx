import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Redirects the user to their default/first business dashboard.
 * Used when accessing /dashboard without a business context.
 * Also gates access: if the user hasn't selected a plan yet, redirects to /select-plan.
 */
export function BusinessRedirect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['business-redirect', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Check if user has selected a plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_selected_plan')
        .eq('id', user.id)
        .maybeSingle();

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

      let businessId = defaultMembership?.business_id ?? null;

      if (!businessId) {
        const { data: firstMembership } = await supabase
          .from('business_members')
          .select('business_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        businessId = firstMembership?.business_id ?? null;
      }

      return {
        hasSelectedPlan: profile?.has_selected_plan ?? false,
        businessId,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading || isLoading || !data) return;

    if (!data.hasSelectedPlan) {
      navigate('/select-plan', { replace: true });
      return;
    }

    if (data.businessId) {
      navigate(`/b/${data.businessId}/dashboard`, { replace: true });
    } else {
      navigate('/select-plan', { replace: true });
    }
  }, [data, authLoading, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
