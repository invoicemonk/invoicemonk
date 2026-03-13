import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [redirectCountdown, setRedirectCountdown] = useState(8);

  useEffect(() => {
    const init = async () => {
      if (user?.id) {
        // Mark plan as selected after successful checkout
        await supabase.from('profiles').update({ has_selected_plan: true }).eq('id', user.id);
        
        // Broadly invalidate all subscription and business queries
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['business-subscription'] });
        queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
        queryClient.invalidateQueries({ queryKey: ['tier-features'] });
      }
    };
    init();

    // Poll for subscription update (webhook may take a few seconds)
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > 10 || !user?.id) {
        clearInterval(pollInterval);
        return;
      }
      // Re-invalidate to pick up webhook changes
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['business-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['tier-features'] });
    }, 3000);

    // Countdown timer for redirect
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
  }, [navigate, queryClient, user?.id]);

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
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription>
              Your subscription has been activated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Thank you for upgrading to a premium plan. You now have access to all the features included in your subscription.
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
        </Card>
      </motion.div>
    </div>
  );
}
