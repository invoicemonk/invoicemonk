import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle, Loader2, Shield, AlertCircle, RefreshCw } from 'lucide-react';
import logo from '@/assets/logo-red.png';

const VerifyEmail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.email_confirmed_at) {
      setIsVerified(true);
      setTimeout(() => {
        navigate('/select-plan');
      }, 2000);
    }
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleResend = useCallback(async () => {
    if (!user?.email || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    setIsResending(false);
    if (error) {
      toast({ title: 'Could not send email', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Verification email sent!', description: 'Please check your inbox.' });
      setResendCooldown(60);
      intervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [user?.email, resendCooldown, isResending]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          {/* Logo */}
          <Link to="/">
            <img src={logo} alt="Invoicemonk" className="h-10 mx-auto mb-8" />
          </Link>

          {/* Card */}
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-xl">
            {isVerified ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Email verified!</h1>
                <p className="text-muted-foreground">
                  Your email has been verified. Redirecting you to select a plan...
                </p>
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
                  {user?.email ? (
                    <p className="text-muted-foreground">
                      We've sent a verification link to{' '}
                      <strong className="text-foreground">{user.email}</strong>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Please check your email for a verification link.
                    </p>
                  )}
                </div>

                {/* Compliance notice */}
                <div className="bg-accent/50 border border-accent rounded-lg p-4 text-left">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-accent-foreground">
                        Email verification required
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To issue compliant invoices, your email must be verified. This ensures the integrity of your financial records.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Click the link in your email to verify your account and start issuing invoices.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button variant="outline" asChild>
                      <Link to="/login">Back to login</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trust badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Email verification protects your financial records</span>
          </div>

          {/* Resend button */}
          {!isVerified && user?.email && (
            <div className="mt-4 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className="w-full"
              >
                {isResending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Resend verification email</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Check your spam folder or contact{' '}
                <a href="mailto:support@invoicemonk.com" className="text-primary hover:underline">
                  support@invoicemonk.com
                </a>
              </p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default VerifyEmail;
