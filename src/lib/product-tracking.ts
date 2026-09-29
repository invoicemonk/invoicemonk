import posthog from 'posthog-js';
import { supabase } from '@/integrations/supabase/client';
import type { ProductArea } from './product-registry';

type Props = Record<string, string | number | boolean | null | undefined>;

function currentBusinessId(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/b\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

/**
 * Record a user-initiated product event. Writes to PostHog and to
 * lifecycle_events (via track_product_event RPC, which computes the journey
 * stage server-side). Never throws, never blocks the UI.
 */
export function trackProductEvent(
  area: ProductArea,
  event: string,
  opts: { workflow?: string; milestone?: 'progress' | 'activated' | 'outcome'; businessId?: string | null; props?: Props } = {},
): void {
  const milestone = opts.milestone ?? 'progress';
  const businessId = opts.businessId ?? currentBusinessId();
  try {
    posthog.capture(`product_${area}_${event}`, { product_area: area, workflow: opts.workflow, milestone, ...opts.props });
  } catch { /* ignore */ }
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { error } = await supabase.rpc('track_product_event' as any, {
        _area: area,
        _workflow: opts.workflow ?? null,
        _event: event,
        _milestone: milestone,
        _business_id: businessId,
        _metadata: opts.props ?? {},
      });
      if (error) console.warn('[product-tracking] RPC failed', error.message);
    } catch (err) {
      console.warn('[product-tracking] failed', err);
    }
  })();
}

/** Same as trackProductEvent but at most once per browser session per key. */
export function trackProductEventOncePerSession(key: string, ...args: Parameters<typeof trackProductEvent>): void {
  try {
    const k = `im_pe_${key}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
  } catch { /* ignore */ }
  trackProductEvent(...args);
}
