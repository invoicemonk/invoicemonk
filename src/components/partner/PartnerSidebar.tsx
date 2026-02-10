import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Link2,
  Users,
  Coins,
  Wallet,
  Settings,
  LogOut,
  ArrowLeft,
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

const navItems = [
  { title: 'Dashboard', url: '/partner', icon: LayoutDashboard },
  { title: 'Referral Links', url: '/partner/links', icon: Link2 },
  { title: 'Referrals', url: '/partner/referrals', icon: Users },
  { title: 'Commissions', url: '/partner/commissions', icon: Coins },
  { title: 'Payouts', url: '/partner/payouts', icon: Wallet },
  { title: 'Settings', url: '/partner/settings', icon: Settings },
];

export function PartnerSidebar() {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/partner') return location.pathname === '/partner';
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-background">
      <SidebarHeader className="border-b border-border p-4">
        <Link to="/partner" className="flex items-center gap-2">
          <img
            src={isCollapsed ? logoIcon : logo}
            alt="Invoicemonk"
            className={cn(
              'object-contain transition-all',
              isCollapsed ? 'h-8 w-8' : 'h-8'
            )}
          />
          {!isCollapsed && (
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Partner</Badge>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Back to Dashboard">
                  <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Exit Partner</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && 'sr-only')}>
            Referral Program
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
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

      <SidebarFooter className="border-t border-border p-4">
        {profile && !isCollapsed && (
          <div className="mb-3 px-2 py-1.5 rounded-lg bg-primary/5">
            <p className="text-sm font-medium truncate">{profile.full_name || 'Partner'}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          onClick={signOut}
          className={cn(
            'text-muted-foreground hover:text-foreground',
            !isCollapsed && 'w-full justify-start'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Log out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
