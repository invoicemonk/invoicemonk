import { Link, useLocation, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  History, 
  Settings,
  LogOut,
  Shield,
  UserCog,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import logo from '@/assets/invoicemonk-logo.png';

const getRoleBadgeVariant = (role: string | null) => {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    case 'auditor':
      return 'outline';
    default:
      return 'outline';
  }
};

export function OrgSidebar() {
  const { signOut, profile } = useAuth();
  const { currentOrg, currentRole, canManageTeam, canEditSettings } = useOrganization();
  const { orgId } = useParams();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const mainNavItems = [
    { title: 'Dashboard', url: `/org/${orgId}/dashboard`, icon: LayoutDashboard },
    { title: 'Invoices', url: `/org/${orgId}/invoices`, icon: FileText },
    { title: 'Reports', url: `/org/${orgId}/reports`, icon: BarChart3 },
    { title: 'Audit Logs', url: `/org/${orgId}/audit-logs`, icon: History },
  ];

  const managementNavItems = [
    ...(canManageTeam ? [{ title: 'Team', url: `/org/${orgId}/team`, icon: UserCog }] : []),
    ...(canEditSettings ? [{ title: 'Settings', url: `/org/${orgId}/settings`, icon: Settings }] : []),
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <Link to={`/org/${orgId}/dashboard`} className="flex items-center gap-2">
          <img 
            src={logo} 
            alt="Invoicemonk" 
            className={cn(
              "object-contain transition-all",
              isCollapsed ? "h-8 w-8" : "h-8"
            )} 
          />
          {!isCollapsed && (
            <span className="font-semibold text-foreground truncate max-w-[140px]">
              {currentOrg?.name || 'Organization'}
            </span>
          )}
        </Link>
        
        {!isCollapsed && currentRole && (
          <div className="mt-2">
            <Badge variant={getRoleBadgeVariant(currentRole)} className="text-xs capitalize">
              {currentRole}
            </Badge>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Back to Personal Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Back to Personal Dashboard"
                >
                  <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">Personal Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            Organization
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {managementNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managementNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4">
        {!isCollapsed && (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Compliance-Ready</span>
          </div>
        )}
        
        {profile && !isCollapsed && (
          <div className="mb-3 px-2 py-1.5 rounded-lg bg-muted/50">
            <p className="text-sm font-medium truncate">{profile.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          onClick={signOut}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            !isCollapsed && "w-full justify-start"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden ml-2">Log out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
