import { Outlet, useParams, Navigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { OrgSidebar } from './OrgSidebar';
import { OrgHeader } from './OrgHeader';
import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function OrgLayoutContent() {
  const { loading, error, currentOrg } = useOrganization();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error || !currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription className="mt-2">
            {error || 'Organization not found or you do not have access.'}
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
        <OrgSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <OrgHeader />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function OrgLayout() {
  return (
    <OrganizationProvider>
      <OrgLayoutContent />
    </OrganizationProvider>
  );
}
