import { Link, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  BarChart3, 
  History, 
  CreditCard, 
  Settings,
  LogOut,
  Shield,
  FileX,
  Bell,
  PieChart,
  Calculator,
  UserPlus,
  ArrowUpRight,
  ChevronDown,
  User,
  Receipt,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { BusinessSwitcher } from './BusinessSwitcher';
import { CurrencyAccountSwitcher } from './CurrencyAccountSwitcher';
import { useUnreadCount } from '@/hooks/use-notifications';
import logo from '@/assets/invoicemonk-logo.png';
import logoIcon from '@/assets/invoicemonk-icon.png';

export function BusinessSidebar() {
  const { signOut, profile } = useAuth();
  const { businessId } = useParams<{ businessId: string }>();
  const { currentBusiness, tier, isFree, canManageTeam } = useBusiness();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { data: unreadCount = 0 } = useUnreadCount();

  const baseUrl = `/b/${businessId}`;

  const mainNavItems = [
    { title: 'Dashboard', url: `${baseUrl}/dashboard`, icon: LayoutDashboard },
    { title: 'Invoices', url: `${baseUrl}/invoices`, icon: FileText },
    { title: 'Credit Notes', url: `${baseUrl}/credit-notes`, icon: FileX },
    { title: 'Receipts', url: `${baseUrl}/receipts`, icon: Receipt },
    { title: 'Clients', url: `${baseUrl}/clients`, icon: Users },
    { title: 'Accounting', url: `${baseUrl}/accounting`, icon: Calculator },
    { title: 'Expenses', url: `${baseUrl}/expenses`, icon: Receipt },
    { title: 'Reports', url: `${baseUrl}/reports`, icon: BarChart3 },
    { title: 'Analytics', url: `${baseUrl}/analytics`, icon: PieChart },
    { title: 'Notifications', url: `${baseUrl}/notifications`, icon: Bell, showBadge: true },
    { title: 'Audit Logs', url: `${baseUrl}/audit-logs`, icon: History },
  ];

  const teamNavItems = canManageTeam ? [
    { title: 'Team', url: `${baseUrl}/team`, icon: UserPlus },
  ] : [];

  const settingsNavItems = [
    { title: 'Business Settings', url: `${baseUrl}/settings`, icon: Settings },
    { title: 'Billing', url: `${baseUrl}/billing`, icon: CreditCard },
    { title: 'Contact Support', url: `${baseUrl}/support`, icon: MessageCircle },
  ];

  const isActive = (path: string) => {
    if (path === `${baseUrl}/dashboard`) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const tierLabel = {
    starter: 'Free',
    starter_paid: 'Starter',
    professional: 'Pro',
    business: 'Business',
  }[tier];

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img 
            src={isCollapsed ? logoIcon : logo} 
            alt="Invoicemonk" 
            className={cn(
              "object-contain transition-all",
              isCollapsed ? "h-8 w-8" : "h-8"
            )} 
          />
        </Link>
        <div className="mt-3 space-y-2">
          <BusinessSwitcher collapsed={isCollapsed} />
          <CurrencyAccountSwitcher collapsed={isCollapsed} />
        </div>
        {!isCollapsed && currentBusiness && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={isFree ? 'outline' : 'default'} className="text-xs">
              {tierLabel}
            </Badge>
            {isFree && (
              <Link to={`${baseUrl}/billing`}>
                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-primary/10">
                  Upgrade <ArrowUpRight className="h-3 w-3 ml-1" />
                </Badge>
              </Link>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            Main
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
                    <Link to={item.url} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </span>
                      {item.showBadge && unreadCount > 0 && !isCollapsed && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {teamNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
              Team
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teamNavItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4">
        {!isCollapsed && (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Compliance-Ready</span>
          </div>
        )}
        
        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 rounded-lg transition-colors w-full text-left",
                  isCollapsed 
                    ? "p-2 justify-center bg-muted hover:bg-accent" 
                    : "px-2 py-1.5 bg-muted/50 hover:bg-muted"
                )}
              >
                {isCollapsed ? (
                  <User className="h-4 w-4" />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profile.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
