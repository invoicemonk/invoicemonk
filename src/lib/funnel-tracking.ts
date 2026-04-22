/**
 * Onboarding funnel tracking — typed wrapper around posthog.capture().
 *
 * Single source of truth for all onboarding_* events so we can build
 * funnels in PostHog without dealing with typo-prone string literals.
 *
 * Events fire even when the user is anonymous; PostHog stitches them to
 * the authenticated user via $device_id once posthog.identify() is called.
 */

import posthog from 'posthog-js';

// All onboarding event names — extend here when adding new funnel steps.
export type OnboardingEvent =
  | 'onboarding_signup_viewed'
  | 'onboarding_signup_submitted'
  | 'onboarding_signup_completed'
  | 'onboarding_signup_failed'
  | 'onboarding_email_verify_viewed'
  | 'onboarding_email_verified'
  | 'onboarding_login_viewed'
  | 'onboarding_login_succeeded'
  | 'onboarding_login_failed'
  | 'onboarding_plan_viewed'
  | 'onboarding_plan_selected'
  | 'onboarding_country_viewed'
  | 'onboarding_country_confirmed'
  | 'onboarding_dashboard_reached'
  | 'onboarding_first_invoice_created'
  | 'onboarding_activated';

type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Capture a funnel event. Safe no-op if PostHog isn't initialised.
 */
export function trackFunnel(event: OnboardingEvent, props: EventProps = {}): void {
  try {
    const refCode =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('pending_referral_code') || undefined
        : undefined;

    posthog.capture(event, {
      ...props,
      referral_code: refCode,
      timestamp_ms: Date.now(),
    });
  } catch (err) {
    // Never let analytics break the app
    console.warn('[funnel-tracking] capture failed:', err);
  }
}

/**
 * Fire an event ONCE per user/device. Used for activation milestones
 * (first invoice created, activated) so we don't double-count.
 *
 * @param key — localStorage key, e.g. 'im_first_invoice_fired'
 * @returns true if the event was newly fired (i.e. first time)
 */
export function trackFunnelOnce(
  event: OnboardingEvent,
  key: string,
  props: EventProps = {},
): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(key) === '1') return false;
    localStorage.setItem(key, '1');
    trackFunnel(event, props);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefetch helpers — stash queries in TanStack Query cache so the next
 * onboarding step renders instantly. Called after signup completion.
 */
export async function prefetchOnboardingData(
  queryClient: import('@tanstack/react-query').QueryClient,
): Promise<void> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    // Prefetch in parallel — both are tiny payloads
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['regional-pricing', 'USD'],
        queryFn: async () => {
          const { data } = await supabase
            .from('pricing_regions')
            .select('*')
            .eq('is_default', true);
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['all-tier-limits'],
        queryFn: async () => {
          const { data } = await supabase
            .from('tier_limits')
            .select('*')
            .order('tier', { ascending: true })
            .order('feature', { ascending: true });
          return data || [];
        },
        staleTime: 10 * 60 * 1000,
      }),
    ]);
  } catch (err) {
    console.warn('[funnel-tracking] prefetch failed:', err);
  }
}
