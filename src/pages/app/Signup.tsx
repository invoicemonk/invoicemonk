import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Mail, Lock, User, Shield, FileCheck } from 'lucide-react';
import { gaEvents } from '@/hooks/use-google-analytics';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { isDisposableEmail } from '@/lib/disposable-emails';
import { supabase } from '@/integrations/supabase/client';

const TURNSTILE_SITE_KEY = '0x4AAAAAAAkZ2xm_NhJMLnfb'; // Cloudflare Turnstile site key

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address').max(255)
    .refine((email) => !isDisposableEmail(email), {
      message: 'Please use a permanent email address. Temporary/disposable emails are not allowed.',
    }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

type SignupFormData = z.infer<typeof signupSchema>;

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiDisposable, setApiDisposable] = useState(false);
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Load Turnstile script
  useEffect(() => {
    if (document.getElementById('cf-turnstile-script')) return;
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    (window as any).onTurnstileLoad = () => {
      if (turnstileRef.current && (window as any).turnstile) {
        (window as any).turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null),
          theme: 'auto',
        });
      }
    };
    document.head.appendChild(script);
  }, []);

  // Capture referral code from URL param or cookie
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      localStorage.setItem('pending_referral_code', refCode);
    } else if (!localStorage.getItem('pending_referral_code')) {
      // Fallback: read from im_ref cookie (set by track-referral-click)
      const cookieMatch = document.cookie.match(/(?:^|;\s*)im_ref=([^;]+)/);
      if (cookieMatch?.[1]) {
        localStorage.setItem('pending_referral_code', cookieMatch[1]);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      if (user.email_confirmed_at) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/verify-email', { replace: true });
      }
    } else {
      // Track signup page view
      gaEvents.signupStarted();
    }
  }, [user, navigate]);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', acceptTerms: false },
  });

  const onSubmit = async (data: SignupFormData) => {
    if (!turnstileToken) {
      toast({
        title: 'Verification required',
        description: 'Please complete the CAPTCHA verification.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    // Verify Turnstile token server-side
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('validate-email', {
        body: { email: data.email, turnstile_token: turnstileToken },
      });

      if (verifyError || verifyData?.turnstile_valid === false) {
        setIsLoading(false);
        toast({
          title: 'Verification failed',
          description: 'CAPTCHA verification failed. Please try again.',
          variant: 'destructive',
        });
        // Reset turnstile
        if ((window as any).turnstile && turnstileRef.current) {
          (window as any).turnstile.reset(turnstileRef.current);
          setTurnstileToken(null);
        }
        return;
      }
    } catch {
      // If verification fails, don't block signup
    }

    const { error } = await signUp(data.email, data.password, data.fullName);
    setIsLoading(false);

    if (error) {
      const msg = error.message || '';
      let errorMessage: string;
      let errorTitle = 'Signup failed';

      if (msg.includes('already registered')) {
        errorMessage = 'An account with this email already exists. Please log in instead.';
      } else if (
        msg.toLowerCase().includes('email') && 
        (msg.toLowerCase().includes('send') || msg.toLowerCase().includes('deliver') || msg.toLowerCase().includes('smtp'))
      ) {
        errorTitle = 'Verification email issue';
        errorMessage = "Your account was created, but we couldn't send the verification email right now. Please try logging in, or contact support if you don't receive a verification email shortly.";
      } else {
        errorMessage = msg;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    } else {
      // Track successful signup
      gaEvents.signupCompleted();
      toast({
        title: 'Account created!',
        description: "Please check your email to verify your account. If you don't see it, check your spam folder and mark it as 'Not Spam'.",
      });
      navigate('/verify-email');
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const password = form.watch('password');
  const passwordStrength = getPasswordStrength(password || '');

  const watchedEmail = form.watch('email');
  const isDisposable = watchedEmail?.includes('@') && isDisposableEmail(watchedEmail);

  const handleEmailBlur = useCallback(async () => {
    const email = form.getValues('email');
    // Skip if empty, invalid format, or already caught by static list
    if (!email || !email.includes('@') || !z.string().email().safeParse(email).success || isDisposableEmail(email)) {
      setApiDisposable(false);
      return;
    }
    setIsValidatingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-email', {
        body: { email },
      });
      if (!error && data?.is_disposable) {
        setApiDisposable(true);
      } else {
        setApiDisposable(false);
      }
    } catch {
      // API failure — don't block signup
      setApiDisposable(false);
    } finally {
      setIsValidatingEmail(false);
    }
  }, [form]);

  return (
    <AuthLayout variant="signup">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
        <p className="text-muted-foreground mt-2">
          Start issuing compliant, verifiable invoices
        </p>
      </div>

      {/* Form */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-xl">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className="pl-10"
                {...form.register('fullName')}
              />
            </div>
            {form.formState.errors.fullName && (
              <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDisposable || apiDisposable ? 'text-destructive' : 'text-muted-foreground'}`} />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className={`pl-10 ${isDisposable || apiDisposable ? 'border-destructive focus-visible:ring-destructive' : ''} ${isValidatingEmail ? 'pr-10' : ''}`}
                {...form.register('email')}
                onBlur={(e) => {
                  form.register('email').onBlur(e);
                  handleEmailBlur();
                }}
              />
              {isValidatingEmail && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {(isDisposable || apiDisposable) && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Temporary/disposable emails are not allowed. Please use a permanent email address.</span>
              </div>
            )}
            {!isDisposable && !apiDisposable && form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
            
            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        passwordStrength >= level
                          ? passwordStrength <= 2
                            ? 'bg-destructive'
                            : passwordStrength <= 3
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength <= 4 ? 'Good' : 'Strong'}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="accept-terms"
              checked={form.watch('acceptTerms')}
              onCheckedChange={(checked) => form.setValue('acceptTerms', checked as boolean)}
            />
            <Label htmlFor="accept-terms" className="text-sm text-muted-foreground leading-relaxed">
              I agree to the{' '}
              <a 
                href="https://invoicemonk.com/terms-of-service" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a 
                href="https://invoicemonk.com/privacy-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>
            </Label>
          </div>
          {form.formState.errors.acceptTerms && (
            <p className="text-sm text-destructive">{form.formState.errors.acceptTerms.message}</p>
          )}

          {/* Turnstile CAPTCHA */}
          <div ref={turnstileRef} className="flex justify-center" />

          <Button type="submit" className="w-full" disabled={isLoading || isDisposable || apiDisposable || isValidatingEmail || !turnstileToken}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="mt-6 flex flex-col gap-2 items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Enterprise-grade security</span>
        </div>
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4" />
          <span>Every action creates an immutable audit trail</span>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Signup;
