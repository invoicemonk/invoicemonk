import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignupPlanAccess } from '@/hooks/use-signup-plan-access';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const requiresPaidAccess = location.pathname === '/dashboard' ||
    location.pathname === '/onboarding' ||
    location.pathname === '/onboarding/country' ||
    location.pathname.startsWith('/onboarding/') ||
    location.pathname.startsWith('/b/');
  const planAccess = useSignupPlanAccess();

  // Check account status once authenticated
  const { data: accountStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['account-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('account_status, closure_reason')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes — avoid refetching mid-form
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });


  if (loading || (user && statusLoading) || (user && requiresPaidAccess && planAccess.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block suspended/closed accounts
  const status = accountStatus?.account_status;
  if (status === 'suspended' || status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Account Suspended</h1>
            <p className="text-muted-foreground">
              Your account has been suspended by a platform administrator.
              {accountStatus?.closure_reason && (
                <span className="block mt-2 text-sm">
                  Reason: {accountStatus.closure_reason}
                </span>
              )}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact support.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="text-sm text-primary underline hover:no-underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // New users verify their email before they can choose a paid plan.
  if (!user.email_confirmed_at && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />;
  }

  if (requiresPaidAccess && planAccess.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-muted-foreground">We couldn’t verify your plan. Please try again.</p>
          <Button variant="outline" onClick={() => { void planAccess.refetch(); }}>Try again</Button>
        </div>
      </div>
    );
  }

  if (requiresPaidAccess && !planAccess.data?.canEnterApp) {
    return <Navigate to="/select-plan" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
