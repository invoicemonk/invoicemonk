import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft, RotateCw, Loader2, MessageCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckout } from '@/hooks/use-checkout';
import { trackFunnel } from '@/lib/funnel-tracking';

const TIER_NAME: Record<string, string> = {
  professional: 'Pro',
  business: 'SME',
};

export default function CheckoutCancel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createCheckoutSession } = useCheckout();
  const [intendedTier, setIntendedTier] = useState<'professional' | 'business' | null>(null);
  const [intendedBilling, setIntendedBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // On mount: read the paid intent, increment the failed-attempt counter,
  // and log the event so we can build a funnel of broken paid checkouts.
  useEffect(() => {
    const run = async () => {
      if (!user?.id) { setLoaded(true); return; }
      const { data } = await supabase
        .from('profiles')
        .select('intended_tier, intended_billing_period, failed_checkout_attempts')
        .eq('id', user.id)
        .maybeSingle();

      const tier = (data?.intended_tier as 'professional' | 'business' | null) || null;
      const billing = (data?.intended_billing_period as 'monthly' | 'yearly' | null) || 'monthly';
      const prevAttempts = data?.failed_checkout_attempts ?? 0;
      const newAttempts = prevAttempts + 1;

      setIntendedTier(tier);
      setIntendedBilling(billing);
      setAttempts(newAttempts);
      setLoaded(true);

      await supabase
        .from('profiles')
        .update({
          failed_checkout_attempts: newAttempts,
          last_failed_checkout_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      trackFunnel('checkout_payment_failed', {
        tier: tier || 'unknown',
        attempt: newAttempts,
      });

      // Fire-and-forget recovery email (rate-limited server-side).
      if (tier) {
        supabase.functions.invoke('send-checkout-recovery-email', {
          body: { tier, billing_period: billing, attempts: newAttempts },
        }).catch(() => {});
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleRetry = async () => {
    if (!intendedTier) {
      navigate('/select-plan');
      return;
    }
    trackFunnel('checkout_payment_retried', { tier: intendedTier, attempt: attempts });
    setRetrying(true);
    await createCheckoutSession(intendedTier, intendedBilling);
    setRetrying(false);
  };

  const handleAbandon = () => {
    trackFunnel('paid_intent_abandoned', {
      tier: intendedTier || 'unknown',
      attempts,
    });
    // The actual downgrade is gated behind the confirm dialog on /select-plan.
    navigate('/select-plan');
  };

  const tierLabel = intendedTier ? TIER_NAME[intendedTier] : null;
  const showAbandonLink = attempts >= 3;
  const showSupportCTA = attempts >= 2;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-md w-full text-center">
          <CardHeader className="pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4"
            >
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-muted-foreground" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">
              {tierLabel ? `Your ${tierLabel} upgrade isn't complete` : 'Checkout cancelled'}
            </CardTitle>
            <CardDescription>
              No charges were made — your card wasn't accepted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loaded && tierLabel ? (
              <p className="text-muted-foreground text-sm">
                The card you used couldn't be authorised. Try a different card to
                finish your {tierLabel} subscription, or contact us if you'd like help.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your checkout was cancelled. You can try again whenever you're ready.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {tierLabel && (
                <Button onClick={handleRetry} disabled={retrying} className="w-full">
                  {retrying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4 mr-2" />
                  )}
                  Try a different card
                </Button>
              )}

              {showSupportCTA && (
                <Button variant="outline" asChild className="w-full">
                  <a href={`mailto:support@invoicemonk.com?subject=Payment%20help%20-%20${tierLabel ?? 'upgrade'}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email support
                  </a>
                </Button>
              )}

              {showSupportCTA && typeof window !== 'undefined' && (window as any).Tawk_API && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => (window as any).Tawk_API?.maximize?.()}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat with us
                </Button>
              )}

              <Button variant="ghost" onClick={() => navigate('/select-plan')} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to plans
              </Button>

              {showAbandonLink && (
                <button
                  type="button"
                  onClick={handleAbandon}
                  className="text-xs text-muted-foreground underline hover:text-foreground mt-2"
                >
                  Continue on Starter (free) instead
                </button>
              )}
            </div>

            {attempts > 0 && (
              <p className="text-xs text-muted-foreground">
                Attempt {attempts}. If your card keeps failing, please contact us
                — we can take payment manually.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
