import { useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { useCheckout } from '@/hooks/use-checkout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Shown at the top of the business app when the active subscription is in
 * Stripe's payment retry grace period (status='past_due'). After the grace
 * window expires the webhook collapses the tier back to starter on its own.
 */
export function PaymentIssueBanner() {
  const { isInGracePeriod, subscription } = useSubscriptionContext();
  const { openCustomerPortal, isLoading } = useCheckout();
  const [dismissed, setDismissed] = useState(false);

  if (!isInGracePeriod || dismissed) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Payment failed on your {subscription?.tier} plan</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
        <span className="flex-1">
          We couldn't charge your card. Update your payment method now to keep
          your paid features — your plan will be downgraded to Starter if it
          isn't fixed within a few days.
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={openCustomerPortal}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Update payment
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
