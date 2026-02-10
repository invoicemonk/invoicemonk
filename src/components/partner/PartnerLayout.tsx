import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { PartnerSidebar } from './PartnerSidebar';
import { PartnerProvider, usePartnerContext } from '@/contexts/PartnerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

function PartnerHeader() {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="text-sm font-semibold text-foreground">Partner Portal</h1>
    </header>
  );
}

function PartnerLayoutContent() {
  const { loading: authLoading } = useAuth();
  const { isPartner, loading, error } = usePartnerContext();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying partner access...</p>
        </div>
      </div>
    );
  }

  if (!isPartner || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription className="mt-2">
            {error || 'You do not have partner privileges to access this area.'}
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PartnerSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <PartnerHeader />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function PartnerLayout() {
  return (
    <PartnerProvider>
      <PartnerLayoutContent />
    </PartnerProvider>
  );
}
