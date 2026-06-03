import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStarterGrace } from '@/hooks/use-starter-grace';
import { usePlatformAdmin } from '@/hooks/use-platform-admin';

/**
 * Persistent banner shown to legacy free Starter users while the
 * free plan is being retired. After grace expires, copy switches to
 * a hard upgrade requirement.
 */
export function StarterSunsetBanner() {
  const { businessId } = useParams<{ businessId: string }>();
  const { isLegacyFreeTier, inGrace, expired, expiresAt, daysLeft } = useStarterGrace();
  const { isPlatformAdmin } = usePlatformAdmin();

  if (isPlatformAdmin) return null;
  if (!isLegacyFreeTier) return null;

  const billingUrl = businessId ? `/b/${businessId}/billing` : '/billing';

  if (expired) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p>
              <span className="font-medium">Your free Starter plan has ended.</span>{' '}
              You can still view and export your data, but creating new invoices
              and expenses is paused until you choose a paid plan.
            </p>
          </div>
          <Button asChild size="sm" variant="destructive" className="shrink-0">
            <Link to={billingUrl}>
              Choose a plan
              <ArrowRight className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!inGrace) return null;

  const dateLabel = expiresAt
    ? expiresAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'soon';

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-medium">
              The free Starter plan is being retired
              {daysLeft != null ? ` in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : ''}
              {` (${dateLabel}).`}
            </span>{' '}
            Upgrade now to keep creating invoices and expenses without interruption.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to={billingUrl}>
            Upgrade
            <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
