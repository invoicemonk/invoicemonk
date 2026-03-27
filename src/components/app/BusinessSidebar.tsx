import { Link, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  BarChart3, 
  Settings,
  LogOut,
  Shield,
  ShieldCheck,
  
  Calculator,
  ArrowUpRight,
  ChevronDown,
  Wallet,
  User,
  Receipt,
  MessageCircle,
  Handshake,
  Package,
  Upload
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

import { usePartnerRole } from '@/hooks/use-partner-role';
import logo from '@/assets/invoicemonk-logo.png';
import logoIcon from '@/assets/invoicemonk-icon.png';

export function BusinessSidebar() {
  const { signOut, profile } = useAuth();
  const { businessId } = useParams<{ businessId: string }>();
  const { currentBusiness, tier, isFree, isPlatformAdmin } = useBusiness();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  const { isPartner } = usePartnerRole();

  const baseUrl = `/b/${businessId}`;

  const mainNavItems = [
    { title: 'Dashboard', url: `${baseUrl}/dashboard`, icon: LayoutDashboard },
    { title: 'Invoices', url: `${baseUrl}/invoices`, icon: FileText },
    
    { title: 'Receipts', url: `${baseUrl}/receipts`, icon: Receipt },
    { title: 'Clients', url: `${baseUrl}/clients`, icon: Users },
    { title: 'Products & Services', url: `${baseUrl}/products`, icon: Package },
    { title: 'Accounting', url: `${baseUrl}/accounting`, icon: Calculator },
    { title: 'Expenses', url: `${baseUrl}/expenses`, icon: Receipt },
    { title: 'Receivables', url: `${baseUrl}/receivables`, icon: Wallet },
    { title: 'Reports', url: `${baseUrl}/reports`, icon: BarChart3 },
  ];

  const settingsNavItems = [
    { title: 'Import Data', url: `${baseUrl}/import`, icon: Upload },
    { title: 'Business Settings', url: `${baseUrl}/settings`, icon: Settings },
  ];

  const openSupportChat = () => {
    if (window.Tawk_API) {
      window.Tawk_API.showWidget();
      window.Tawk_API.maximize();
      window.Tawk_API.onChatMinimized = () => {
        window.Tawk_API?.hideWidget();
      };
    }
  };

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
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Contact Support"
                  onClick={openSupportChat}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Contact Support</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
              {isPartner && (
                <DropdownMenuItem asChild>
                  <Link to="/partner" className="cursor-pointer">
                    <Handshake className="mr-2 h-4 w-4" />
                    Partner Portal
                  </Link>
                </DropdownMenuItem>
              )}
              {isPlatformAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="cursor-pointer">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              {(isPartner || isPlatformAdmin) && <DropdownMenuSeparator />}
              {!isPartner && (
                <DropdownMenuItem asChild>
                  <Link to="/partner/apply" className="cursor-pointer">
                    <Handshake className="mr-2 h-4 w-4" />
                    Become a Partner
                  </Link>
                </DropdownMenuItem>
              )}
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
