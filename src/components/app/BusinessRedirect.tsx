import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { trackFunnelOnce } from '@/lib/funnel-tracking';

/**
 * Redirects the user to their default/first business dashboard.
 *
 * Gate: `profiles.has_selected_plan` must be true. New signups default to
 * `true` (free tier is a valid selected plan), so the paywall only fires
 * for pre-existing accounts flagged `false` from the legacy paid-only flow.
 * We no longer require a live Stripe subscription here — free users are
 * first-class.
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
        hasSelectedPlan: profile?.has_selected_plan ?? true,
        businessId,
        onboardingStep,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading || isLoading || !data) return;

    // Only legacy accounts explicitly flagged `has_selected_plan = false`
    // still get pushed to the pricing page.
    if (!data.hasSelectedPlan) {
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
      // No business yet — start them in onboarding on the free tier.
      navigate('/onboarding', { replace: true });
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
