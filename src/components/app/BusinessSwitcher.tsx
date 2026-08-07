import { useState } from 'react';
import { INPUT_LIMITS } from '@/lib/input-limits';
import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, Plus, Building2, User, Check, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';
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
import { useDeleteBusiness } from '@/hooks/use-delete-business';
import { DeleteBusinessDialog } from '@/components/app/DeleteBusinessDialog';
import { ALL_CURRENCIES } from '@/hooks/use-business-currency';
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

const SUPPORTED_CURRENCY_CODES = new Set<string>(ALL_CURRENCIES.map((c) => c.value as string));

/** Returns the country's ISO currency if InvoiceMonk supports it, otherwise null. */
function supportedCurrencyForCountry(countryCode: string): string | null {
  const currency = COUNTRIES.find((c) => c.code === countryCode)?.currency;
  if (!currency) return null;
  return SUPPORTED_CURRENCY_CODES.has(currency) ? currency : null;
}

export function BusinessSwitcher({ collapsed }: BusinessSwitcherProps) {
  const businessContext = useBusinessOptional();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showNewBusinessDialog, setShowNewBusinessDialog] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('freelancer');
  const [newBusinessCountry, setNewBusinessCountry] = useState('');
  const [newBusinessCurrency, setNewBusinessCurrency] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; country?: string; currency?: string }>({});
  const [businessToDelete, setBusinessToDelete] = useState<{ id: string; name: string } | null>(null);
  const createBusiness = useCreateBusiness();
  const deleteBusiness = useDeleteBusiness();

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

  const resetNewBusinessForm = () => {
    setNewBusinessName('');
    setNewBusinessType('freelancer');
    setNewBusinessCountry('');
    setNewBusinessCurrency('');
    setFormError(null);
    setFieldErrors({});
  };

  const handleNewBusinessDialogChange = (open: boolean) => {
    setShowNewBusinessDialog(open);
    if (!open) resetNewBusinessForm();
  };

  const handleCountryChange = (countryCode: string) => {
    setNewBusinessCountry(countryCode);
    setFieldErrors((prev) => ({ ...prev, country: undefined, currency: undefined }));
    setFormError(null);

    const currency = supportedCurrencyForCountry(countryCode);
    if (currency) {
      setNewBusinessCurrency(currency);
    } else {
      const countryCurrency = COUNTRIES.find((c) => c.code === countryCode)?.currency;
      setNewBusinessCurrency('');
      setFieldErrors((prev) => ({
        ...prev,
        currency: countryCurrency
          ? `${countryCurrency} is not supported yet. Choose a supported currency to continue.`
          : 'Choose a supported currency to continue.',
      }));
    }
  };

  const handleCreateBusiness = async () => {
    const errors: { name?: string; country?: string; currency?: string } = {};
    if (!newBusinessName.trim()) errors.name = 'Business name is required.';
    if (!newBusinessCountry) errors.country = 'Country is required.';
    if (!newBusinessCurrency) {
      errors.currency = fieldErrors.currency || 'Currency is required.';
    } else if (!SUPPORTED_CURRENCY_CODES.has(newBusinessCurrency)) {
      errors.currency = 'This currency is not supported yet. Choose a supported currency.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please complete the highlighted fields before continuing.');
      return;
    }

    setFieldErrors({});
    setFormError(null);

    try {
      const newBusiness = await createBusiness.mutateAsync({
        name: newBusinessName.trim(),
        jurisdiction: newBusinessCountry,
        business_type: newBusinessType,
        default_currency: newBusinessCurrency,
      });

      handleNewBusinessDialogChange(false);

      await refreshBusiness();

      // Navigate to the new business
      if (newBusiness?.id) {
        navigate(`/b/${newBusiness.id}/dashboard`);
      }
    } catch (error) {
      console.error('Error creating business:', error);
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not create the business. Please try again.'
      );
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

  const newBusinessDialog = (
    <Dialog open={showNewBusinessDialog} onOpenChange={handleNewBusinessDialogChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Business</DialogTitle>
          <DialogDescription>
            Add another business to manage separately. Each business has its own subscription, invoices, and clients.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="businessName">
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="businessName"
              placeholder="My New Business"
              value={newBusinessName}
              onChange={(e) => {
                setNewBusinessName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
                setFormError(null);
              }}
              maxLength={INPUT_LIMITS.NAME}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="businessType">Business Type</Label>
            <Select value={newBusinessType} onValueChange={setNewBusinessType}>
              <SelectTrigger id="businessType">
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
            <Label htmlFor="country">
              Country <span className="text-destructive">*</span>
            </Label>
            <Select value={newBusinessCountry} onValueChange={handleCountryChange}>
              <SelectTrigger id="country" aria-invalid={!!fieldErrors.country}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.country && (
              <p className="text-xs text-destructive">{fieldErrors.country}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="businessCurrency">
              Currency <span className="text-destructive">*</span>
            </Label>
            <Select
              value={newBusinessCurrency}
              onValueChange={(value) => {
                setNewBusinessCurrency(value);
                setFieldErrors((prev) => ({ ...prev, currency: undefined }));
                setFormError(null);
              }}
            >
              <SelectTrigger id="businessCurrency" aria-invalid={!!fieldErrors.currency}>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {ALL_CURRENCIES.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.currency ? (
              <p className="text-xs text-destructive">{fieldErrors.currency}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Auto-filled from the country you select. This becomes the primary accounting currency for this business.
              </p>
            )}
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{formError}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleNewBusinessDialogChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateBusiness} disabled={createBusiness.isPending}>
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
  );

  const deleteDialog = businessToDelete && (
    <DeleteBusinessDialog
      open={!!businessToDelete}
      onOpenChange={(open) => {
        if (!open) setBusinessToDelete(null);
      }}
      businessName={businessToDelete.name}
      onConfirm={() =>
        deleteBusiness.mutate(businessToDelete.id, {
          onSuccess: () => setBusinessToDelete(null),
        })
      }
      isPending={deleteBusiness.isPending}
    />
  );

  if (!currentBusiness) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNewBusinessDialog(true)}
          className={cn("w-full justify-start gap-2", collapsed && "justify-center px-2")}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Create Business</span>}
        </Button>
        {newBusinessDialog}
      </>
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
            const canDelete = !isDefault && membership.role === 'owner';
            
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
                {canDelete && (
                  <button
                    type="button"
                    aria-label={`Delete ${membership.business.name}`}
                    title="Delete business"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOpen(false);
                      setBusinessToDelete({
                        id: membership.business_id,
                        name: membership.business.name,
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
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

      {newBusinessDialog}
      {deleteDialog}
    </>
  );
}
