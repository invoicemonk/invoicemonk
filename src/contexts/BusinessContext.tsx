import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Tables } from '@/integrations/supabase/types';

type Business = Tables<'businesses'> & {
  registration_status?: string;
  is_default?: boolean;
};
type BusinessMember = Tables<'business_members'>;
type Subscription = Tables<'subscriptions'>;

export type BusinessRole = 'owner' | 'admin' | 'member' | 'auditor';
export type SubscriptionTier = 'starter' | 'starter_paid' | 'professional' | 'business';

interface BusinessMembership extends BusinessMember {
  business: Business;
}

interface TierLimit {
  id: string;
  tier: SubscriptionTier;
  feature: string;
  limit_value: number | null;
  limit_type: 'count' | 'boolean' | 'unlimited';
  description: string | null;
}

interface TierCheckResult {
  allowed: boolean;
  tier: SubscriptionTier;
  feature: string;
  limit_type?: string;
  current_count?: number;
  limit_value?: number;
  remaining?: number;
  reason?: string;
}

interface BusinessContextType {
  // Current active business
  currentBusiness: Business | null;
  currentRole: BusinessRole | null;
  subscription: Subscription | null;
  
  // All businesses user has access to
  businesses: BusinessMembership[];
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  switchBusiness: (businessId: string) => void;
  refreshBusiness: () => Promise<void>;
  
  // Permissions (role-based)
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isAuditor: boolean;
  canManageTeam: boolean;
  canCreateInvoices: boolean;
  canViewReports: boolean;
  canEditSettings: boolean;
  
  // Subscription / Plan helpers
  tier: SubscriptionTier;
  limits: TierLimit[];
  canAccess: (feature: string) => boolean;
  hasTier: (requiredTier: SubscriptionTier) => boolean;
  getLimit: (feature: string) => TierLimit | undefined;
  checkTierLimit: (feature: string) => Promise<TierCheckResult>;
  isStarter: boolean;
  isStarterPaid: boolean;
  isProfessional: boolean;
  isBusiness: boolean;
  isFree: boolean;
  isPaid: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

// Tier order for comparison
const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  starter_paid: 1,
  professional: 2,
  business: 3,
};

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const { businessId } = useParams<{ businessId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentRole, setCurrentRole] = useState<BusinessRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all businesses the user belongs to
  const { data: businesses = [], isLoading: loadingBusinesses } = useQuery({
    queryKey: ['user-businesses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error: fetchError } = await supabase
        .from('business_members')
        .select(`
          *,
          business:businesses(*)
        `)
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      return (data || []).map(item => ({
        ...item,
        business: item.business as unknown as Business,
      })) as BusinessMembership[];
    },
    enabled: !!user,
  });

  // Fetch subscription for current business
  const { data: subscription, isLoading: loadingSubscription } = useQuery({
    queryKey: ['business-subscription', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return null;
      
      const { data, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('Subscription fetch error:', subError);
        return null;
      }

      return data as Subscription | null;
    },
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60 * 1000,
  });

  const tier: SubscriptionTier = (subscription?.tier as SubscriptionTier) || 'starter';

  // Fetch tier limits
  const { data: limits = [] } = useQuery({
    queryKey: ['tier-limits', tier],
    queryFn: async () => {
      const { data, error: limitsError } = await supabase
        .from('tier_limits')
        .select('*')
        .eq('tier', tier);

      if (limitsError) {
        console.error('Tier limits fetch error:', limitsError);
        return [];
      }

      return data as TierLimit[];
    },
    enabled: !!currentBusiness?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Set current business based on URL or default
  useEffect(() => {
    if (loadingBusinesses || !user) return;

    // If we have a businessId in URL, find that business
    if (businessId) {
      const membership = businesses.find(m => m.business_id === businessId);
      if (membership) {
        setCurrentBusiness(membership.business);
        setCurrentRole(membership.role as BusinessRole);
        setError(null);
      } else {
        setError('Business not found or you do not have access');
        // Redirect to default business
        const defaultBusiness = businesses.find(m => m.business.is_default) || businesses[0];
        if (defaultBusiness) {
          navigate(`/b/${defaultBusiness.business_id}/dashboard`, { replace: true });
        }
      }
    } else {
      // No businessId in URL - find default or first business
      const defaultBusiness = businesses.find(m => m.business.is_default) || businesses[0];
      if (defaultBusiness) {
        setCurrentBusiness(defaultBusiness.business);
        setCurrentRole(defaultBusiness.role as BusinessRole);
        setError(null);
      } else {
        setCurrentBusiness(null);
        setCurrentRole(null);
      }
    }
  }, [businessId, businesses, loadingBusinesses, user, navigate]);

  const refreshBusiness = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
    await queryClient.invalidateQueries({ queryKey: ['business-subscription'] });
  }, [queryClient]);

  const switchBusiness = useCallback((newBusinessId: string) => {
    // Get the current path segment after the business ID
    const currentPath = location.pathname;
    const pathAfterBusiness = currentPath.replace(/^\/b\/[^/]+/, '') || '/dashboard';
    navigate(`/b/${newBusinessId}${pathAfterBusiness}`);
  }, [navigate, location.pathname]);

  // Role-based permissions
  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin' || isOwner;
  const isMember = currentRole === 'member' || isAdmin;
  const isAuditor = currentRole === 'auditor';

  const canManageTeam = isOwner || isAdmin;
  const canCreateInvoices = isMember && !isAuditor;
  const canViewReports = true; // All roles can view reports
  const canEditSettings = isOwner || isAdmin;

  // Subscription helpers
  const canAccess = (feature: string): boolean => {
    const limit = limits.find((l) => l.feature === feature);
    if (!limit) return true;

    if (limit.limit_type === 'boolean') {
      return limit.limit_value === 1;
    }

    if (limit.limit_type === 'unlimited' || limit.limit_value === null) {
      return true;
    }

    return true;
  };

  const hasTier = (requiredTier: SubscriptionTier): boolean => {
    return TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
  };

  const getLimit = (feature: string): TierLimit | undefined => {
    return limits.find((l) => l.feature === feature);
  };

  const checkTierLimit = async (feature: string): Promise<TierCheckResult> => {
    if (!currentBusiness?.id) {
      return {
        allowed: false,
        tier: 'starter',
        feature,
        reason: 'no_business_context',
      };
    }

    const { data, error: rpcError } = await supabase.rpc('check_tier_limit_business', {
      _business_id: currentBusiness.id,
      _feature: feature,
    });

    if (rpcError || !data) {
      console.error('Tier check error:', rpcError);
      return {
        allowed: false,
        tier: 'starter',
        feature,
        reason: 'check_failed',
      };
    }

    const result = typeof data === 'object' && data !== null && !Array.isArray(data)
      ? data as unknown as TierCheckResult
      : { allowed: false, tier: 'starter' as SubscriptionTier, feature, reason: 'invalid_response' };

    return result;
  };

  const loading = loadingBusinesses || loadingSubscription;

  return (
    <BusinessContext.Provider
      value={{
        currentBusiness,
        currentRole,
        subscription,
        businesses,
        loading,
        error,
        switchBusiness,
        refreshBusiness,
        isOwner,
        isAdmin,
        isMember,
        isAuditor,
        canManageTeam,
        canCreateInvoices,
        canViewReports,
        canEditSettings,
        tier,
        limits,
        canAccess,
        hasTier,
        getLimit,
        checkTierLimit,
        isStarter: tier === 'starter',
        isStarterPaid: tier === 'starter_paid',
        isProfessional: tier === 'professional' || tier === 'business',
        isBusiness: tier === 'business',
        isFree: tier === 'starter',
        isPaid: tier !== 'starter',
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};

// Safe version that returns null when used outside BusinessProvider
export const useBusinessOptional = () => {
  return useContext(BusinessContext);
};

// Re-export types for convenience
export type { Business, Subscription, TierLimit, TierCheckResult, BusinessMembership };
