import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, Plus, Building2, User, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBusinessOptional, type BusinessMembership, type SubscriptionTier } from '@/contexts/BusinessContext';
import { useCreateBusiness } from '@/hooks/use-business';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface BusinessSwitcherProps {
  collapsed?: boolean;
}

const tierLabels: Record<SubscriptionTier, string> = {
  starter: 'Free',
  starter_paid: 'Starter',
  professional: 'Pro',
  business: 'Business',
};

const businessTypeLabels: Record<string, string> = {
  freelancer: 'Individual',
  small_business: 'Small Business',
  agency: 'Agency',
  registered_company: 'Company',
};

export function BusinessSwitcher({ collapsed }: BusinessSwitcherProps) {
  const businessContext = useBusinessOptional();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showNewBusinessDialog, setShowNewBusinessDialog] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('freelancer');
  const [newBusinessCountry, setNewBusinessCountry] = useState('NG');
  const createBusiness = useCreateBusiness();

  // Fetch businesses directly when outside BusinessProvider
  const { data: fallbackBusinesses = [], isLoading: fallbackLoading } = useQuery({
    queryKey: ['user-businesses-fallback', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('business_members')
        .select(`
          *,
          business:businesses(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        business: item.business as unknown as BusinessMembership['business'],
      })) as BusinessMembership[];
    },
    enabled: !businessContext && !!user,
  });

  // Use context values if available, otherwise use fallback
  const businesses = businessContext?.businesses ?? fallbackBusinesses;
  const currentBusiness = businessContext?.currentBusiness ?? (businesses.find(b => b.business.is_default)?.business || businesses[0]?.business);
  const loading = businessContext?.loading ?? fallbackLoading;

  const switchBusiness = (businessId: string) => {
    if (businessContext?.switchBusiness) {
      businessContext.switchBusiness(businessId);
    } else {
      // Navigate directly to business route when outside BusinessProvider
      navigate(`/b/${businessId}/dashboard`);
    }
  };

  const refreshBusiness = async () => {
    if (businessContext?.refreshBusiness) {
      await businessContext.refreshBusiness();
    }
  };

  // Fetch subscriptions for all businesses
  const { data: subscriptionMap = {} } = useQuery({
    queryKey: ['business-subscriptions', businesses.map(b => b.business_id)],
    queryFn: async () => {
      if (businesses.length === 0) return {};
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .in('business_id', businesses.map(b => b.business_id))
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching subscriptions:', error);
        return {};
      }

      const map: Record<string, SubscriptionTier> = {};
      data?.forEach(sub => {
        if (sub.business_id) {
          map[sub.business_id] = sub.tier as SubscriptionTier;
        }
      });
      return map;
    },
    enabled: businesses.length > 0,
  });

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim()) return;

    try {
      const newBusiness = await createBusiness.mutateAsync({
        name: newBusinessName.trim(),
        jurisdiction: newBusinessCountry,
      });
      
      setShowNewBusinessDialog(false);
      setNewBusinessName('');
      setNewBusinessType('freelancer');
      
      await refreshBusiness();
      
      // Navigate to the new business
      if (newBusiness?.id) {
        navigate(`/b/${newBusiness.id}/dashboard`);
      }
    } catch (error) {
      console.error('Error creating business:', error);
    }
  };

  const getBusinessIcon = (business: BusinessMembership['business']) => {
    if (business.is_default || business.business_type === 'freelancer') {
      return <User className="h-4 w-4" />;
    }
    return <Building2 className="h-4 w-4" />;
  };

  const getRegistrationLabel = (business: BusinessMembership['business']) => {
    const status = (business as { registration_status?: string }).registration_status;
    if (status === 'registered') return 'Registered';
    if (status === 'pending') return 'Pending';
    return 'Unregistered';
  };

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-muted-foreground",
        collapsed && "justify-center px-0"
      )}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {!collapsed && <span className="text-sm">Loading...</span>}
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowNewBusinessDialog(true)}
        className={cn("w-full justify-start gap-2", collapsed && "justify-center px-2")}
      >
        <Plus className="h-4 w-4" />
        {!collapsed && <span>Create Business</span>}
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-between gap-2 border-border/50",
              "hover:bg-accent hover:text-accent-foreground",
              collapsed 
                ? "justify-center px-2 bg-muted" 
                : "bg-background/50"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              {getBusinessIcon(currentBusiness)}
              {!collapsed && (
                <span className="truncate text-sm font-medium">
                  {currentBusiness.name}
                </span>
              )}
            </div>
            {!collapsed && <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[280px]" align="start" side="bottom">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Business
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {businesses.map((membership) => {
            const isSelected = membership.business_id === currentBusiness.id;
            const tier = subscriptionMap[membership.business_id] || 'starter';
            const isDefault = membership.business.is_default;
            
            return (
              <DropdownMenuItem
                key={membership.business_id}
                onClick={() => {
                  if (!isSelected) {
                    switchBusiness(membership.business_id);
                  }
                  setIsOpen(false);
                }}
                className="flex items-start gap-3 p-3 cursor-pointer"
              >
                <div className="mt-0.5">
                  {getBusinessIcon(membership.business)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {membership.business.name}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {isDefault ? 'Individual' : getRegistrationLabel(membership.business)}
                    </span>
                    <Badge 
                      variant={tier === 'starter' ? 'outline' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {tierLabels[tier]}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false);
              setShowNewBusinessDialog(true);
            }}
            className="gap-2 text-muted-foreground cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Another Business
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create New Business Dialog */}
      <Dialog open={showNewBusinessDialog} onOpenChange={setShowNewBusinessDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create a New Business</DialogTitle>
            <DialogDescription>
              Add another business to manage separately. Each business has its own subscription, invoices, and clients.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                placeholder="My New Business"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select value={newBusinessType} onValueChange={setNewBusinessType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="freelancer">Freelance / Individual</SelectItem>
                  <SelectItem value="small_business">Small Business / SME</SelectItem>
                  <SelectItem value="agency">Agency / Studio</SelectItem>
                  <SelectItem value="registered_company">Registered Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Select value={newBusinessCountry} onValueChange={setNewBusinessCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NG">Nigeria</SelectItem>
                  <SelectItem value="GH">Ghana</SelectItem>
                  <SelectItem value="KE">Kenya</SelectItem>
                  <SelectItem value="ZA">South Africa</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBusinessDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBusiness}
              disabled={!newBusinessName.trim() || createBusiness.isPending}
            >
              {createBusiness.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Business'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
