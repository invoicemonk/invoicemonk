import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    countryCode?: string
  ) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { tier, billingPeriod, countryCode },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
        options.onSuccess?.();
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create checkout session';
      console.error('Checkout error:', message);
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
        throw new Error(error.message || 'Failed to open customer portal');
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open customer portal';
      console.error('Portal error:', message);
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
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      toast.success(data?.message || 'Subscription cancelled');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
      console.error('Cancel error:', message);
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
