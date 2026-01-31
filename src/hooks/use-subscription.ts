import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'starter' | 'starter_paid' | 'professional' | 'business';

export interface TierLimit {
  id: string;
  tier: SubscriptionTier;
  feature: string;
  limit_value: number | null;
  limit_type: 'count' | 'boolean' | 'unlimited';
  description: string | null;
}

export interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
}

export interface TierCheckResult {
  allowed: boolean;
  tier: SubscriptionTier;
  feature: string;
  limit_type?: string;
  current_count?: number;
  limit_value?: number;
  remaining?: number;
  reason?: string;
}

// Tier order for comparison
const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  starter_paid: 1,
  professional: 2,
  business: 3,
};

export function useSubscription() {
  const { user } = useAuth();

  const subscriptionQuery = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Subscription fetch error:', error);
        return null;
      }

      return data as Subscription | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const limitsQuery = useQuery({
    queryKey: ['tier-limits', subscriptionQuery.data?.tier || 'starter'],
    queryFn: async () => {
      const tier = subscriptionQuery.data?.tier || 'starter';

      const { data, error } = await supabase
        .from('tier_limits')
        .select('*')
        .eq('tier', tier);

      if (error) {
        console.error('Tier limits fetch error:', error);
        return [];
      }

      return data as TierLimit[];
    },
    enabled: subscriptionQuery.isSuccess,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const tier: SubscriptionTier = subscriptionQuery.data?.tier || 'starter';
  const limits = limitsQuery.data || [];

  // Check if a feature is available for the current tier
  const canAccess = (feature: string): boolean => {
    const limit = limits.find((l) => l.feature === feature);
    if (!limit) return true; // No limit defined = allowed

    if (limit.limit_type === 'boolean') {
      return limit.limit_value === 1;
    }

    if (limit.limit_type === 'unlimited' || limit.limit_value === null) {
      return true;
    }

    // For count limits, we can't check client-side without the current count
    // Return true and let server enforce it
    return true;
  };

  // Check if the current tier is at least the required tier
  const hasTier = (requiredTier: SubscriptionTier): boolean => {
    return TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
  };

  // Get limit value for a feature
  const getLimit = (feature: string): TierLimit | undefined => {
    return limits.find((l) => l.feature === feature);
  };

  // Check tier limit via RPC (for count-based limits with current count)
  const checkTierLimit = async (feature: string): Promise<TierCheckResult> => {
    if (!user?.id) {
      return {
        allowed: false,
        tier: 'starter',
        feature,
        reason: 'not_authenticated',
      };
    }

    const { data, error } = await supabase.rpc('check_tier_limit', {
      _user_id: user.id,
      _feature: feature,
    });

    if (error || !data) {
      console.error('Tier check error:', error);
      return {
        allowed: false,
        tier: 'starter',
        feature,
        reason: 'check_failed',
      };
    }

    // Parse JSONB response from RPC
    const result = typeof data === 'object' && data !== null && !Array.isArray(data)
      ? data as unknown as TierCheckResult
      : { allowed: false, tier: 'starter' as SubscriptionTier, feature, reason: 'invalid_response' };

    return result;
  };

  return {
    subscription: subscriptionQuery.data,
    tier,
    limits,
    isLoading: subscriptionQuery.isLoading || limitsQuery.isLoading,
    isError: subscriptionQuery.isError || limitsQuery.isError,
    canAccess,
    hasTier,
    getLimit,
    checkTierLimit,
    // Quick access helpers
    isStarter: tier === 'starter',
    isStarterPaid: tier === 'starter_paid',
    isProfessional: tier === 'professional' || tier === 'business',
    isBusiness: tier === 'business',
    // For display purposes, treat starter and starter_paid as "free tier" category
    isFree: tier === 'starter',
    isPaid: tier !== 'starter',
  };
}

// Hook to check invoice limit specifically
export function useInvoiceLimitCheck() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoice-limit-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc('check_tier_limit', {
        _user_id: user.id,
        _feature: 'invoices_per_month',
      });

      if (error || !data) {
        console.error('Invoice limit check error:', error);
        return null;
      }

      // Parse JSONB response from RPC
      const result = typeof data === 'object' && data !== null && !Array.isArray(data)
        ? data as unknown as TierCheckResult
        : null;

      return result;
    },
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute - check more frequently
  });
}
