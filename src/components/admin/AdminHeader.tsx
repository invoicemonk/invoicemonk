import { ShieldAlert } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useLocation, Link } from 'react-router-dom';

export function AdminHeader() {
  const location = useLocation();

  // Get current page name from path
  const getPageName = () => {
    const path = location.pathname;
    if (path === '/admin') return 'Overview';
    if (path.includes('/users')) return 'Users';
    if (path.includes('/businesses')) return 'Businesses';
    if (path.includes('/invoices')) return 'Invoices';
    if (path.includes('/audit-logs')) return 'Audit Logs';
    if (path.includes('/billing')) return 'Billing';
    if (path.includes('/country-modules')) return 'Country Modules';
    if (path.includes('/system')) return 'System';
    return 'Admin';
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-destructive/20 px-4 bg-destructive/5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <Badge variant="destructive" className="text-xs">Platform Admin</Badge>
      </div>
      
      <Separator orientation="vertical" className="mx-2 h-4" />
      
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin">Admin</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{getPageName()}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto">
        <p className="text-xs text-muted-foreground">
          All actions are logged
        </p>
      </div>
    </header>
  );
}
