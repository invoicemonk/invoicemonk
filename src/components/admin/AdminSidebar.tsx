import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  FileText,
  History,
  CreditCard,
  Globe,
  Settings,
  LogOut,
  ShieldAlert,
  ArrowLeft,
  Clock,
  MessageCircle,
  Bell
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
import logoIcon from '@/assets/invoicemonk-icon.png';

const mainNavItems = [
  { title: 'Overview', url: '/admin', icon: LayoutDashboard },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Businesses', url: '/admin/businesses', icon: Building2 },
  { title: 'Invoices', url: '/admin/invoices', icon: FileText },
  { title: 'Partners', url: '/admin/partners', icon: Users },
  { title: 'Support Tickets', url: '/admin/support', icon: MessageCircle },
  { title: 'Notifications', url: '/admin/notifications', icon: Bell },
  { title: 'Audit Logs', url: '/admin/audit-logs', icon: History },
];

const complianceNavItems = [
  { title: 'Retention Policies', url: '/admin/retention-policies', icon: Clock },
  { title: 'Invoice Templates', url: '/admin/templates', icon: FileText },
];

const systemNavItems = [
  { title: 'Billing', url: '/admin/billing', icon: CreditCard },
  { title: 'Country Modules', url: '/admin/country-modules', icon: Globe },
  { title: 'System', url: '/admin/system', icon: Settings },
];

export function AdminSidebar() {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-destructive/20 bg-background">
      <SidebarHeader className="border-b border-destructive/20 p-4">
        <Link to="/admin" className="flex items-center gap-2">
          <img 
            src={isCollapsed ? logoIcon : logo} 
            alt="Invoicemonk" 
            className={cn(
              "object-contain transition-all",
              isCollapsed ? "h-8 w-8" : "h-8"
            )} 
          />
          {!isCollapsed && (
            <Badge variant="destructive" className="text-xs">Admin</Badge>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Back to User Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Back to User Dashboard"
                >
                  <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Exit Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            Management
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
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            Compliance
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {complianceNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-destructive/20 p-4">
        {!isCollapsed && (
          <div className="mb-3 flex items-center gap-2 text-xs text-destructive">
            <ShieldAlert className="h-3 w-3" />
            <span>Admin Mode Active</span>
          </div>
        )}
        
        {profile && !isCollapsed && (
          <div className="mb-3 px-2 py-1.5 rounded-lg bg-destructive/10">
            <p className="text-sm font-medium truncate">{profile.full_name || 'Admin'}</p>
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
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Log out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
