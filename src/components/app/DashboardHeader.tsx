import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/invoices': 'Invoices',
  '/invoices/new': 'New Invoice',
  '/clients': 'Clients',
  '/reports': 'Reports',
  '/audit-logs': 'Audit Logs',
  '/business-profile': 'Business Profile',
  '/billing': 'Billing',
  '/settings': 'Settings',
};

export function DashboardHeader() {
  const location = useLocation();
  const currentTitle = routeTitles[location.pathname] || 'Dashboard';
  const isSubPage = location.pathname.split('/').length > 2;
  const parentPath = '/' + location.pathname.split('/')[1];
  const parentTitle = routeTitles[parentPath];

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <SidebarTrigger className="-ml-2" />
      <Separator orientation="vertical" className="h-6" />
      
      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          {isSubPage && parentTitle && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={parentPath}>{parentTitle}</BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-9 bg-muted/50 border-transparent focus:border-border"
          />
        </div>
        
        <NotificationDropdown />
      </div>
    </header>
  );
}
