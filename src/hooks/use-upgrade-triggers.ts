import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/use-subscription';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformAdmin } from '@/hooks/use-platform-admin';

const DISMISS_KEY = 'upgrade-modal-dismissed-second_invoice';

export function useUpgradeTriggers() {
  const { user } = useAuth();
  const { tier, isLoading: subLoading } = useSubscription();
  const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const { data: totalInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['upgrade-trigger-invoices', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from('user_activity_state' as any)
        .select('total_invoices')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as any)?.total_invoices ?? 0;
    },
    enabled: !!user?.id && tier === 'starter' && !dismissed,
    staleTime: 5 * 60 * 1000,
  });

  const showUpgradeModal =
    !subLoading &&
    !invoicesLoading &&
    !dismissed &&
    tier === 'starter' &&
    typeof totalInvoices === 'number' &&
    totalInvoices >= 2;

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  return {
    showUpgradeModal,
    trigger: showUpgradeModal ? 'second_invoice' : null,
    dismiss,
    isLoading: subLoading || invoicesLoading,
  };
}
