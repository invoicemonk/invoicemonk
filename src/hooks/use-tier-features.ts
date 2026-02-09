import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness, type SubscriptionTier } from '@/contexts/BusinessContext';

export interface TierLimit {
  id: string;
  tier: SubscriptionTier;
  feature: string;
  limit_type: 'boolean' | 'count' | 'unlimited';
  limit_value: number | null;
  description: string | null;
}

// Fetch all tier limits from database
export function useAllTierLimits() {
  return useQuery({
    queryKey: ['all-tier-limits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tier_limits')
        .select('*')
        .order('tier', { ascending: true })
        .order('feature', { ascending: true });

      if (error) throw error;
      return data as TierLimit[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get features for a specific tier
export function useTierFeatures() {
  const { data: allLimits, isLoading, error } = useAllTierLimits();

  const getFeaturesByTier = (tier: SubscriptionTier): TierLimit[] => {
    return allLimits?.filter(l => l.tier === tier) || [];
  };

  const getFeatureLimit = (tier: SubscriptionTier, feature: string): TierLimit | undefined => {
    return allLimits?.find(l => l.tier === tier && l.feature === feature);
  };

  // Check if team access is available for a tier
  const hasTeamAccess = (tier: SubscriptionTier): boolean => {
    const limit = getFeatureLimit(tier, 'team_members_limit');
    if (!limit) return false;
    // team_members_limit = 0 means no access, NULL means unlimited
    return limit.limit_value === null || limit.limit_value > 0;
  };

  // Check if a boolean feature is enabled
  const isFeatureEnabled = (tier: SubscriptionTier, feature: string): boolean => {
    const limit = getFeatureLimit(tier, feature);
    if (!limit) return true; // Default to enabled if not defined
    if (limit.limit_type === 'boolean') {
      return limit.limit_value === 1;
    }
    return true;
  };

  // Get formatted limit display string
  const getFormattedLimit = (tier: SubscriptionTier, feature: string): string => {
    const limit = getFeatureLimit(tier, feature);
    if (!limit) return 'Unlimited';
    
    if (limit.limit_type === 'unlimited' || limit.limit_value === null) {
      return 'Unlimited';
    }
    
    if (limit.limit_type === 'boolean') {
      return limit.limit_value === 1 ? 'Yes' : 'No';
    }
    
    return limit.limit_value.toString();
  };

  // Build feature list for display in plan selection/billing pages
  const buildFeatureList = (tier: SubscriptionTier): string[] => {
    const limits = getFeaturesByTier(tier);
    const features: string[] = [];

    // Invoice limit
    const invoiceLimit = limits.find(l => l.feature === 'invoices_per_month');
    if (invoiceLimit) {
      if (invoiceLimit.limit_value !== null && invoiceLimit.limit_type === 'count') {
        features.push(`${invoiceLimit.limit_value} invoices/month`);
      } else {
        features.push('Unlimited invoices');
      }
    }

    // Receipt limit
    const receiptLimit = limits.find(l => l.feature === 'receipts_limit');
    if (receiptLimit) {
      if (receiptLimit.limit_value !== null && receiptLimit.limit_type === 'count') {
        features.push(`${receiptLimit.limit_value} receipts/month`);
      } else {
        features.push('Unlimited receipts');
      }
    }

    // Currency accounts
    const currencyLimit = limits.find(l => l.feature === 'currency_accounts_limit');
    if (currencyLimit) {
      if (currencyLimit.limit_value === 1) {
        features.push('1 currency account');
      } else if (currencyLimit.limit_value !== null && currencyLimit.limit_type === 'count') {
        features.push(`${currencyLimit.limit_value} currency accounts`);
      } else {
        features.push('Unlimited currency accounts');
      }
    }

    // Team members
    const teamLimit = limits.find(l => l.feature === 'team_members_limit');
    if (teamLimit) {
      if (teamLimit.limit_value === 0) {
        features.push('Single user only');
      } else if (teamLimit.limit_value !== null && teamLimit.limit_type === 'count') {
        features.push(`Up to ${teamLimit.limit_value} team members`);
      } else if (teamLimit.limit_type === 'unlimited' || teamLimit.limit_value === null) {
        features.push('Unlimited team members');
      }
    }

    // Boolean features
    const booleanFeatures = [
      { key: 'accounting_enabled', label: 'Accounting module' },
      { key: 'expenses_enabled', label: 'Expense tracking' },
      { key: 'credit_notes_enabled', label: 'Credit notes' },
      { key: 'support_enabled', label: 'In-app support' },
      { key: 'audit_logs_visible', label: 'Full audit trail' },
      { key: 'exports_enabled', label: 'Data exports' },
      { key: 'branding_allowed', label: 'Custom branding' },
    ];

    booleanFeatures.forEach(({ key, label }) => {
      const limit = limits.find(l => l.feature === key);
      if (limit?.limit_value === 1) {
        features.push(label);
      }
    });

    return features;
  };

  return {
    allLimits,
    isLoading,
    error,
    getFeaturesByTier,
    getFeatureLimit,
    hasTeamAccess,
    isFeatureEnabled,
    getFormattedLimit,
    buildFeatureList,
  };
}

// Hook to check if the current business has team access
export function useTeamAccess() {
  const { currentBusiness, checkTierLimit } = useBusiness();

  return useQuery({
    queryKey: ['team-access-check', currentBusiness?.id],
    queryFn: async () => {
      const result = await checkTierLimit('team_members_limit');
      return {
        hasAccess: result.allowed || (result.limit_value !== 0),
        limit: result.limit_value,
        currentCount: result.current_count,
        tier: result.tier,
      };
    },
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60 * 1000,
  });
}
