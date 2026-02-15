import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Mail, Lock, Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { gaEvents } from '@/hooks/use-google-analytics';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (lockoutRef.current) clearInterval(lockoutRef.current);
    };
  }, []);

  const handleResendFromLogin = useCallback(async () => {
    if (!unverifiedEmail || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: unverifiedEmail });
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
  }, [unverifiedEmail, resendCooldown, isResending]);

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const startLockout = useCallback(() => {
    setLockoutSeconds(60);
    if (lockoutRef.current) clearInterval(lockoutRef.current);
    lockoutRef.current = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          if (lockoutRef.current) clearInterval(lockoutRef.current);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const isLockedOut = lockoutSeconds > 0;

  const onSubmit = async (data: LoginFormData) => {
    if (isLockedOut) return;
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);

    if (error) {
      setIsLoading(false);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        startLockout();
      }
      const isUnverified = error.message?.toLowerCase().includes('email not confirmed');
      if (isUnverified) {
        setEmailNotVerified(true);
        setUnverifiedEmail(data.email);
      }
      toast({
        title: 'Login failed',
        description: isUnverified
          ? 'Your email is not verified yet. Please check your inbox.'
          : error.message === 'Invalid login credentials'
            ? 'Invalid email or password. Please try again.'
            : error.message,
        variant: 'destructive',
      });
    } else {
      setFailedAttempts(0);
      // Track successful login
      gaEvents.loginSuccess();
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
      navigate(from, { replace: true });
    }
  };

  return (
    <AuthLayout variant="login">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-muted-foreground mt-2">
          Access your compliance-ready invoicing dashboard
        </p>
      </div>

      {/* Form */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-xl">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-10"
                {...form.register('email')}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-10 pr-10"
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {isLockedOut && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Too many attempts. Try again in {lockoutSeconds}s</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || isLockedOut}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : isLockedOut ? (
              `Locked (${lockoutSeconds}s)`
            ) : (
              'Log in'
            )}
          </Button>
      </form>

        {emailNotVerified && (
          <div className="mt-4 bg-accent/50 border border-accent rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-accent-foreground">
                  Your email is not verified yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Check your inbox for a verification link, or resend it below.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendFromLogin}
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
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Trust badge */}
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4" />
        <span>Your data is encrypted and audit-ready</span>
      </div>
    </AuthLayout>
  );
};

export default Login;
