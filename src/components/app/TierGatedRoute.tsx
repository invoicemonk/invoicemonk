import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { UpgradeRequiredPage } from './UpgradeRequiredPage';

interface TierGatedRouteProps {
  feature: string;
  featureDisplayName: string;
  featureDescription: string;
  requiredTier?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Route wrapper that gates access based on tier limits.
 * Shows an upgrade prompt if the feature is not available on the current tier.
 */
export function TierGatedRoute({
  feature,
  featureDisplayName,
  featureDescription,
  requiredTier = 'Professional',
  children,
  fallback,
}: TierGatedRouteProps) {
  const { businessId } = useParams<{ businessId: string }>();
  const { currentBusiness, checkTierLimit } = useBusiness();

  const { data: access, isLoading } = useQuery({
    queryKey: ['tier-gate', currentBusiness?.id, feature],
    queryFn: () => checkTierLimit(feature),
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if access is denied
  // For team_members_limit, limit_value = 0 means no access
  const isAccessDenied = 
    access?.allowed === false || 
    (feature === 'team_members_limit' && access?.limit_value === 0);

  if (isAccessDenied) {
    if (fallback) {
      return <>{fallback}</>;
    }

    const billingUrl = businessId ? `/b/${businessId}/billing` : '/billing';

    return (
      <UpgradeRequiredPage
        feature={featureDisplayName}
        description={featureDescription}
        upgradeUrl={billingUrl}
        requiredTier={requiredTier}
      />
    );
  }

  return <>{children}</>;
}
