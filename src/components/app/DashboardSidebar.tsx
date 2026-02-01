import { Link, useLocation } from 'react-router-dom';
import { 
  Settings,
  LogOut,
  Shield,
  ChevronDown,
  User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
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
import logo from '@/assets/invoicemonk-logo.png';
import logoIcon from '@/assets/invoicemonk-icon.png';
import { BusinessSwitcher } from './BusinessSwitcher';

const settingsNavItems = [
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function DashboardSidebar() {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

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
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
            Your Businesses
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <BusinessSwitcher collapsed={isCollapsed} />
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
