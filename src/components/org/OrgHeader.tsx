import { Building2, ChevronDown } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useLocation, Link } from 'react-router-dom';

export function OrgHeader() {
  const { currentOrg, memberships, switchOrg } = useOrganization();
  const location = useLocation();

  // Get current page name from path
  const getPageName = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/invoices')) return 'Invoices';
    if (path.includes('/reports')) return 'Reports';
    if (path.includes('/audit-logs')) return 'Audit Logs';
    if (path.includes('/team')) return 'Team';
    if (path.includes('/settings')) return 'Settings';
    return 'Overview';
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/50 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 font-normal">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{currentOrg?.name || 'Organization'}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.map((membership) => (
                  <DropdownMenuItem
                    key={membership.business_id}
                    onClick={() => switchOrg(membership.business_id)}
                    className={membership.business_id === currentOrg?.id ? 'bg-accent' : ''}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {membership.business.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <span className="text-muted-foreground">← Back to Personal</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{getPageName()}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
