import { Outlet, useParams, Navigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { BusinessSidebar } from './BusinessSidebar';
import { DashboardHeader } from './DashboardHeader';
import { ImpersonationBanner } from './ImpersonationBanner';
import { BusinessProvider, useBusiness } from '@/contexts/BusinessContext';
import { CurrencyAccountProvider } from '@/contexts/CurrencyAccountContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { UpgradeModal } from './UpgradeModal';
import { PaymentIssueBanner } from '@/components/billing/PaymentIssueBanner';
import { StarterSunsetBanner } from '@/components/billing/StarterSunsetBanner';


function BusinessLayoutContent() {
  const { loading, error, currentBusiness } = useBusiness();

  if (!currentBusiness && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading business...</p>
        </div>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription className="mt-2">
            {error || 'Business not found or you do not have access.'}
          </AlertDescription>
          <div className="mt-4">
            <Button asChild>
              <Link to="/dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        </Alert>
      </div>
    );
  }


  // Gate the business workspace behind a completed onboarding.
  // Only redirect when we have a definite step value that is not 'completed'.
  // Treat null/undefined as "still loading" to avoid bouncing the user out of
  // long-running forms (e.g. invoice creation) when a query briefly refetches.
  const onboardingStep = (currentBusiness as any).onboarding_step;
  if (onboardingStep != null && onboardingStep !== 'completed') {
    return <Navigate to={`/onboarding/${currentBusiness.id}`} replace />;
  }


  return (
    <SubscriptionProvider>
      <CurrencyAccountProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <BusinessSidebar />
            <SidebarInset className="flex flex-col flex-1">
              <ImpersonationBanner />
              <DashboardHeader />
              <StarterSunsetBanner />
              <PaymentIssueBanner />
              <main className="flex-1 p-6 overflow-auto">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
        <UpgradeModal />
      </CurrencyAccountProvider>
    </SubscriptionProvider>
  );
}

export function BusinessLayout() {
  return (
    <BusinessProvider>
      <BusinessLayoutContent />
    </BusinessProvider>
  );
}
