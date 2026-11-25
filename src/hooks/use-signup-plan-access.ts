import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SignupSubscriptionState {
  tier: string;
  status: string;
}

const PAID_TIERS = ['starter_paid', 'professional', 'business'] as const;

export function hasActivePaidSubscription(
  subscription: SignupSubscriptionState | null | undefined,
): boolean {
  return Boolean(
    subscription &&
      subscription.status === 'active' &&
      PAID_TIERS.includes(subscription.tier as (typeof PAID_TIERS)[number]),
  );
}

export function canEnterApp(
  hasSelectedPlan: boolean | null | undefined,
  subscription: SignupSubscriptionState | null | undefined,
): boolean {
  return hasSelectedPlan === true || hasActivePaidSubscription(subscription);
}

export function useSignupPlanAccess() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['signup-plan-access', user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) throw new Error('A signed-in account is required.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('has_selected_plan')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      const hasSelectedPlan = profile?.has_selected_plan === true;

      if (hasSelectedPlan) {
        return {
          hasSelectedPlan: true,
          hasActivePaidSubscription: false,
          canEnterApp: true,
        };
      }

      const { data: userSubscription, error: userSubscriptionError } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('tier', [...PAID_TIERS])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (userSubscriptionError) throw userSubscriptionError;

      let activePaidSubscription = userSubscription;
      if (!activePaidSubscription) {
        const { data: memberships, error: membershipsError } = await supabase
          .from('business_members')
          .select('business_id')
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null);

        if (membershipsError) throw membershipsError;

        const businessIds = memberships?.map((membership) => membership.business_id) ?? [];
        if (businessIds.length > 0) {
          const { data: businessSubscription, error: businessSubscriptionError } = await supabase
            .from('subscriptions')
            .select('tier, status')
            .in('business_id', businessIds)
            .eq('status', 'active')
            .in('tier', [...PAID_TIERS])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (businessSubscriptionError) throw businessSubscriptionError;
          activePaidSubscription = businessSubscription;
        }
      }

      return {
        hasSelectedPlan: false,
        hasActivePaidSubscription: hasActivePaidSubscription(activePaidSubscription),
        canEnterApp: canEnterApp(hasSelectedPlan, activePaidSubscription),
      };
    },
  });
}