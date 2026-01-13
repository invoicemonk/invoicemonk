import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  User, 
  Check,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUserOrganizations } from '@/hooks/use-user-organizations';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  collapsed?: boolean;
}

export function OrganizationSwitcher({ collapsed = false }: OrganizationSwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: organizations, isLoading } = useUserOrganizations();
  
  // Determine current context from URL
  const isOrgContext = location.pathname.startsWith('/org/');
  const currentOrgId = isOrgContext 
    ? location.pathname.split('/')[2] 
    : null;
  
  const currentOrg = organizations?.find(o => o.business_id === currentOrgId);
  
  const handleSelectPersonal = () => {
    navigate('/dashboard');
  };
  
  const handleSelectOrg = (orgId: string) => {
    navigate(`/org/${orgId}/dashboard`);
  };

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            {currentOrg ? (
              <Avatar className="h-6 w-6">
                <AvatarImage src={currentOrg.business.logo_url || undefined} />
                <AvatarFallback className="text-xs bg-brand-100 text-brand-700">
                  {currentOrg.business.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleSelectPersonal}
            className="flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            <span>Personal Account</span>
            {!isOrgContext && <Check className="h-4 w-4 ml-auto text-brand-600" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Organizations
          </DropdownMenuLabel>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : organizations && organizations.length > 0 ? (
            organizations.map((org) => (
              <DropdownMenuItem
                key={org.business_id}
                onClick={() => handleSelectOrg(org.business_id)}
                className="flex items-center gap-2"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={org.business.logo_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-brand-100 text-brand-700">
                    {org.business.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{org.business.name}</span>
                {currentOrgId === org.business_id && (
                  <Check className="h-4 w-4 ml-auto text-brand-600" />
                )}
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No organizations yet
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/business-profile" className="flex items-center gap-2 text-brand-600">
              <Plus className="h-4 w-4" />
              <span>Create Organization</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between h-auto py-2 px-3 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 min-w-0">
            {currentOrg ? (
              <>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={currentOrg.business.logo_url || undefined} />
                  <AvatarFallback className="text-xs bg-brand-100 text-brand-700">
                    {currentOrg.business.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {currentOrg.business.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {currentOrg.role}
                  </Badge>
                </div>
              </>
            ) : (
              <>
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Personal Account</span>
                  <span className="text-[10px] text-muted-foreground">Individual</span>
                </div>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSelectPersonal}
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          <span>Personal Account</span>
          {!isOrgContext && <Check className="h-4 w-4 ml-auto text-brand-600" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : organizations && organizations.length > 0 ? (
          organizations.map((org) => (
            <DropdownMenuItem
              key={org.business_id}
              onClick={() => handleSelectOrg(org.business_id)}
              className="flex items-center gap-2"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={org.business.logo_url || undefined} />
                <AvatarFallback className="text-[10px] bg-brand-100 text-brand-700">
                  {org.business.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="truncate">{org.business.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{org.role}</span>
              </div>
              {currentOrgId === org.business_id && (
                <Check className="h-4 w-4 ml-auto text-brand-600" />
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            No organizations yet
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/business-profile" className="flex items-center gap-2 text-brand-600">
            <Plus className="h-4 w-4" />
            <span>Create Organization</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
