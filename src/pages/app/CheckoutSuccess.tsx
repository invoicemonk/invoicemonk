import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addTags } from '@/lib/onesignal';

type VerifyState =
  | { kind: 'verifying' }
  | { kind: 'paid' }
  | { kind: 'unpaid'; reason?: string };

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [state, setState] = useState<VerifyState>({ kind: 'verifying' });
  const [redirectCountdown, setRedirectCountdown] = useState(8);

  // Verify the Stripe session server-side before trusting success.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) return;
      if (!sessionId) {
        setState({ kind: 'unpaid', reason: 'Missing checkout session reference.' });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('verify-checkout-session', {
          body: { session_id: sessionId },
        });
        if (cancelled) return;
        if (error || !data) {
          setState({ kind: 'unpaid', reason: 'Could not verify your payment with Stripe.' });
          return;
        }
        if (data.paid) {
          setState({ kind: 'paid' });
          addTags({ stripe_checkout_completed: 'true' });
          supabase.functions.invoke('track-auth-event', {
            body: { event_type: 'plan_selected' },
          }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          queryClient.invalidateQueries({ queryKey: ['business-subscription'] });
          queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
          queryClient.invalidateQueries({ queryKey: ['tier-features'] });
        } else {
          setState({ kind: 'unpaid', reason: data.error || 'Your payment was not completed.' });
        }
      } catch (e) {
        if (cancelled) return;
        setState({ kind: 'unpaid', reason: 'Could not verify your payment.' });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user?.id, sessionId, queryClient]);

  // Poll subscription cache once paid (webhook may still be catching up).
  useEffect(() => {
    if (state.kind !== 'paid' || !user?.id) return;
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount > 10) { clearInterval(pollInterval); return; }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['business-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['tier-features'] });
    }, 3000);
    const countdownInterval = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [state.kind, user?.id, queryClient, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-md w-full text-center">
          {state.kind === 'verifying' && (
            <>
              <CardHeader className="pb-4">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <CardTitle className="text-2xl">Verifying payment…</CardTitle>
                <CardDescription>Hang tight while we confirm your subscription with Stripe.</CardDescription>
              </CardHeader>
              <CardContent />
            </>
          )}

          {state.kind === 'paid' && (
            <>
              <CardHeader className="pb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mx-auto mb-4"
                >
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-10 w-10 text-primary" />
                  </div>
                </motion.div>
                <CardTitle className="text-2xl">Payment Successful!</CardTitle>
                <CardDescription>Your subscription has been activated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground">
                  Thank you for upgrading. You now have access to all the features included in your subscription.
                </p>
                {sessionId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Session ID: {sessionId.slice(0, 20)}...
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  <Button onClick={() => navigate('/dashboard')} className="w-full">
                    Go to Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/billing')} className="w-full">
                    View Billing
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to dashboard in {redirectCountdown} seconds...
                </div>
              </CardContent>
            </>
          )}

          {state.kind === 'unpaid' && (
            <>
              <CardHeader className="pb-4">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Payment not completed</CardTitle>
                <CardDescription>
                  {state.reason || 'We couldn’t confirm your payment with Stripe.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground text-sm">
                  Your account has not been upgraded. Please pick a plan and try the checkout again.
                  If you believe you were charged, contact support and we’ll sort it out.
                </p>
                <div className="flex flex-col gap-3">
                  <Button onClick={() => navigate('/select-plan')} className="w-full">
                    Try again
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/select-plan')} className="w-full">
                    Back to plans
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
