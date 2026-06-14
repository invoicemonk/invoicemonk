import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Redirects the user to their default/first business dashboard.
 * Gates:
 *  - must have selected a plan (profiles.has_selected_plan)
 *  - AND must have an active/trialing/past_due subscription (defence-in-depth
 *    against the legacy bug where /checkout/success flipped has_selected_plan
 *    without verifying payment).
 */
export function BusinessRedirect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['business-redirect', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('has_selected_plan')
        .eq('id', user.id)
        .maybeSingle();

      // Find a live subscription on the user OR any of their businesses.
      const { data: memberships } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id);
      const businessIds = (memberships ?? []).map(m => m.business_id);

      const liveStatuses = ['active', 'trialing', 'past_due'] as const;

      const { data: userSubs } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .in('status', liveStatuses)
        .limit(1);

      let hasLiveSubscription = (userSubs?.length ?? 0) > 0;
      if (!hasLiveSubscription && businessIds.length > 0) {
        const { data: bizSubs } = await supabase
          .from('subscriptions')
          .select('id')
          .in('business_id', businessIds)
          .in('status', liveStatuses)
          .limit(1);
        hasLiveSubscription = (bizSubs?.length ?? 0) > 0;
      }

      const { data: defaultMembership } = await supabase
        .from('business_members')
        .select(`
          business_id,
          business:businesses!inner(id, is_default, jurisdiction, onboarding_step)
        `)
        .eq('user_id', user.id)
        .eq('businesses.is_default', true)
        .limit(1)
        .maybeSingle();

      let businessId = defaultMembership?.business_id ?? null;
      let onboardingStep = (defaultMembership?.business as any)?.onboarding_step ?? null;

      if (!businessId) {
        const { data: firstMembership } = await supabase
          .from('business_members')
          .select(`
            business_id,
            business:businesses!inner(id, jurisdiction, onboarding_step)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        businessId = firstMembership?.business_id ?? null;
        onboardingStep = (firstMembership?.business as any)?.onboarding_step ?? null;
      }

      return {
        hasSelectedPlan: profile?.has_selected_plan ?? false,
        hasLiveSubscription,
        businessId,
        onboardingStep,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading || isLoading || !data) return;

    // Require BOTH the flag and an actual live subscription.
    if (!data.hasSelectedPlan || !data.hasLiveSubscription) {
      navigate('/select-plan', { replace: true });
      return;
    }

    if (data.businessId) {
      if (data.onboardingStep !== 'completed') {
        navigate(`/onboarding/${data.businessId}`, { replace: true });
        return;
      }
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
