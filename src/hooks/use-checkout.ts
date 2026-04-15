import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { captureError } from '@/lib/sentry';

type BillingPeriod = 'monthly' | 'yearly';
type Tier = 'professional' | 'business';

interface UseCheckoutOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useCheckout(options: UseCheckoutOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);

  const createCheckoutSession = async (
    tier: Tier,
    billingPeriod: BillingPeriod = 'monthly',
    businessId?: string
  ) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { tier, billingPeriod, businessId },
      });

      if (error) {
        const serverMsg = typeof data === 'object' && data?.error ? data.error : (error.message || 'Failed to create checkout session');
        throw new Error(serverMsg);
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
        options.onSuccess?.();
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      captureError(error, { hook: 'useCheckout', action: 'createCheckoutSession' });
      const message = error instanceof Error ? error.message : 'Failed to create checkout session';
      toast.error(message);
      options.onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'portal' },
      });

      if (error) {
        const serverMsg = typeof data === 'object' && data?.error ? data.error : (error.message || 'Failed to open customer portal');
        throw new Error(serverMsg);
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      captureError(error, { hook: 'useCheckout', action: 'openCustomerPortal' });
      const message = error instanceof Error ? error.message : 'Failed to open customer portal';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'cancel' },
      });

      if (error) {
        const serverMsg = typeof data === 'object' && data?.error ? data.error : (error.message || 'Failed to cancel subscription');
        throw new Error(serverMsg);
      }

      toast.success(data?.message || 'Subscription cancelled');
      return true;
    } catch (error) {
      captureError(error, { hook: 'useCheckout', action: 'cancelSubscription' });
      const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createCheckoutSession,
    openCustomerPortal,
    cancelSubscription,
    isLoading,
  };
}
