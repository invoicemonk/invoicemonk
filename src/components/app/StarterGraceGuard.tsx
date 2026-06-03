import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useStarterGrace } from '@/hooks/use-starter-grace';
import { usePlatformAdmin } from '@/hooks/use-platform-admin';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeRequiredPage } from './UpgradeRequiredPage';

interface StarterGraceGuardProps {
  feature: string;
  description: string;
  children: ReactNode;
}

/**
 * Blocks creation/edit surfaces for legacy free Starter users whose
 * grace period has expired. Read-only routes do not use this guard.
 */
export function StarterGraceGuard({ feature, description, children }: StarterGraceGuardProps) {
  const { businessId } = useParams<{ businessId: string }>();
  const { expired } = useStarterGrace();
  const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const { isLoading: subLoading } = useSubscription();

  if (subLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (expired && !isPlatformAdmin) {
    const billingUrl = businessId ? `/b/${businessId}/billing` : '/billing';
    return (
      <UpgradeRequiredPage
        feature={feature}
        description={description}
        upgradeUrl={billingUrl}
        requiredTier="Professional"
      />
    );
  }

  return <>{children}</>;
}
