import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/use-subscription';

/**
 * Tracks the grace-period status for legacy free Starter users.
 * The free Starter plan has been retired — existing users get a
 * countdown banner and, once expired, are restricted to read-only.
 */
export function useStarterGrace() {
  const { user } = useAuth();
  const { subscription, tier } = useSubscription();

  const isLegacyFreeTier = tier === 'starter' || tier === 'starter_paid';

  const { data: graceRow } = useQuery({
    queryKey: ['starter-grace', user?.id],
    enabled: !!user?.id && isLegacyFreeTier,
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('starter_grace_expires_at')
        .eq('id', subscription?.id ?? '')
        .maybeSingle();
      return (data as any)?.starter_grace_expires_at as string | null | undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    if (!isLegacyFreeTier) {
      return { isLegacyFreeTier: false, inGrace: false, expired: false, expiresAt: null as Date | null, daysLeft: null as number | null };
    }
    const expiresAtStr = graceRow ?? null;
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
    const now = Date.now();
    const expired = !!expiresAt && expiresAt.getTime() <= now;
    const inGrace = !!expiresAt && !expired;
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)))
      : null;
    return { isLegacyFreeTier: true, inGrace, expired, expiresAt, daysLeft };
  }, [isLegacyFreeTier, graceRow]);
}
