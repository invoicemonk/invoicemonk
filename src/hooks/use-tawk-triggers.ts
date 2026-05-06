import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  fireTawkMessage,
  isSessionLocked,
  hasFiredForUser,
  readLastVisit,
  writeLastVisit,
  returnVisitOnCooldown,
  markReturnVisitFired,
} from '@/lib/tawk-triggers';

const PRICING_DELAY_MS = 20_000;
const RETURN_VISIT_DELAY_MS = 15_000;
const STUCK_DELAY_MS = 3 * 60_000;
const RETURN_VISIT_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000;

const EXCLUDED_PREFIXES = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/admin',
  '/verify/',
  '/invoice/view/',
  '/legal/',
  '/docs/',
  '/demo/',
];

const MESSAGES = {
  pricing:
    "Hey — noticed you're checking out the Pro plan. Any questions I can answer? I'm Bami, I built Invoicemonk, so feel free to ask me anything directly.",
  milestone:
    "You've sent 5 invoices on Invoicemonk — nice! How's it going so far? Anything feeling clunky or missing for you?",
  returnVisit:
    "Welcome back! It's been a little while — is there something specific you were trying to do today? Happy to help.",
  stuck:
    "Taking a while to set this up? If anything's confusing or not working, just let me know — happy to help you through it.",
};

function isInvoiceWorkPath(pathname: string): boolean {
  // /b/:businessId/invoices/new  or  /b/:businessId/invoices/:id/edit
  return /^\/b\/[^/]+\/invoices\/(new|[^/]+\/edit)\/?$/.test(pathname);
}

function isExcluded(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));
}

export function useTawkTriggers() {
  const { user } = useAuth();
  const location = useLocation();
  const userId = user?.id;
  const pathname = location.pathname;
  const excluded = !userId || isExcluded(pathname);

  // --- Trigger 2: Invoice milestone (count = 5) ---
  const { data: invoiceCount } = useQuery({
    queryKey: ['tawk-invoice-count', userId],
    enabled: !!userId && !hasFiredForUser('invoice_milestone_5', userId || ''),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', userId!);
      const ids = (memberships || []).map((m: any) => m.business_id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .in('business_id', ids);
      return count || 0;
    },
  });

  useEffect(() => {
    if (!userId || invoiceCount == null) return;
    if (invoiceCount < 5) return;
    if (hasFiredForUser('invoice_milestone_5', userId)) return;
    void fireTawkMessage({
      userId,
      triggerKey: 'invoice_milestone_5',
      message: MESSAGES.milestone,
      event: { name: 'invoice_milestone', props: { count: 5 } },
      // Lifetime trigger — bypass session lock so it still fires
      ignoreSessionLock: true,
    });
  }, [userId, invoiceCount]);

  // --- Track last visit (for trigger 3) ---
  const lastVisitRef = useRef<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    lastVisitRef.current = readLastVisit(userId);
    writeLastVisit(userId);
  }, [userId]);

  // --- Trigger 1, 3, 4: route-scoped timers ---
  useEffect(() => {
    if (excluded || !userId) return;
    if (isSessionLocked()) return;

    const timers: number[] = [];

    // Trigger 1: pricing dwell
    if (pathname.startsWith('/select-plan') && !hasFiredForUser('pricing_dwell', userId)) {
      timers.push(
        window.setTimeout(() => {
          void fireTawkMessage({
            userId,
            triggerKey: 'pricing_dwell',
            message: MESSAGES.pricing,
          });
        }, PRICING_DELAY_MS),
      );
    }

    // Trigger 4: stuck on invoice form
    if (isInvoiceWorkPath(pathname) && !hasFiredForUser('stuck_invoice', userId)) {
      timers.push(
        window.setTimeout(() => {
          void fireTawkMessage({
            userId,
            triggerKey: 'stuck_invoice',
            message: MESSAGES.stuck,
          });
        }, STUCK_DELAY_MS),
      );
    }

    // Trigger 3: return visit (any non-excluded route)
    const prevVisit = lastVisitRef.current;
    if (
      prevVisit &&
      Date.now() - prevVisit >= RETURN_VISIT_THRESHOLD_MS &&
      !returnVisitOnCooldown(userId) &&
      !hasFiredForUser('return_visit', userId)
    ) {
      timers.push(
        window.setTimeout(async () => {
          const fired = await fireTawkMessage({
            userId,
            triggerKey: 'return_visit',
            message: MESSAGES.returnVisit,
          });
          if (fired) markReturnVisitFired(userId);
        }, RETURN_VISIT_DELAY_MS),
      );
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [pathname, userId, excluded]);
}
