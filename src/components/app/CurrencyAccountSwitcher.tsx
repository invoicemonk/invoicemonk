import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Wallet, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from '@/components/ui/badge';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useCreateCurrencyAccount, useCurrencyAccountLimit } from '@/hooks/use-currency-accounts';
import { useBusiness } from '@/contexts/BusinessContext';
import { getCurrencySymbol } from '@/lib/utils';

const AVAILABLE_CURRENCIES = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
];

interface Props {
  collapsed?: boolean;
}

export function CurrencyAccountSwitcher({ collapsed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');
  const [newName, setNewName] = useState('');

  const { currentBusiness, isFree } = useBusiness();
  const { 
    currentCurrencyAccount, 
    currencyAccounts, 
    switchCurrencyAccount,
    loading 
  } = useCurrencyAccount();
  
  const createAccount = useCreateCurrencyAccount();
  const { data: limitInfo } = useCurrencyAccountLimit(currentBusiness?.id);

  // Get currencies already in use
  const usedCurrencies = currencyAccounts.map(a => a.currency);
  const availableCurrencies = AVAILABLE_CURRENCIES.filter(c => !usedCurrencies.includes(c.code));

  const handleCreateAccount = async () => {
    if (!newCurrency) return;
    
    await createAccount.mutateAsync({
      currency: newCurrency,
      name: newName || undefined,
    });
    
    setCreateDialogOpen(false);
    setNewCurrency('');
    setNewName('');
  };

  const canCreateMore = limitInfo?.allowed ?? false;
  const isAtLimit = !canCreateMore && currencyAccounts.length > 0;

  if (loading || currencyAccounts.length === 0) {
    return null;
  }

  // Don't show switcher if only one account
  if (currencyAccounts.length === 1 && !canCreateMore) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground",
        collapsed && "justify-center px-0"
      )}>
        <Wallet className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <span className="truncate">
            {currentCurrencyAccount?.currency} Account
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-muted/50 hover:bg-muted",
              collapsed && "w-auto px-2"
            )}
            size="sm"
          >
            <div className="flex items-center gap-2 truncate">
              <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
              {!collapsed && (
                <>
                  <span className="font-medium">
                    {currentCurrencyAccount?.currency}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {currentCurrencyAccount?.name || 'Account'}
                  </span>
                </>
              )}
            </div>
            {!collapsed && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search accounts..." />
            <CommandList>
              <CommandEmpty>No accounts found.</CommandEmpty>
              <CommandGroup heading="Currency Accounts">
                {currencyAccounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={account.id}
                    onSelect={() => {
                      switchCurrencyAccount(account.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getCurrencySymbol(account.currency)}</span>
                      <span>{account.currency}</span>
                      {account.is_default && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          Default
                        </Badge>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        currentCurrencyAccount?.id === account.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                {canCreateMore && availableCurrencies.length > 0 ? (
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setCreateDialogOpen(true);
                    }}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Currency Account
                  </CommandItem>
                ) : isAtLimit ? (
                  <CommandItem asChild>
                    <Link 
                      to={`/b/${currentBusiness?.id}/billing`}
                      className="text-muted-foreground flex items-center"
                      onClick={() => setOpen(false)}
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Upgrade for more accounts
                    </Link>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Currency Account Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Currency Account</DialogTitle>
            <DialogDescription>
              Create a new currency account to track finances in a different currency.
              All invoices and expenses will be strictly scoped to this account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select value={newCurrency} onValueChange={setNewCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Account Name (optional)</Label>
              <Input
                id="name"
                placeholder={newCurrency ? `${newCurrency} Account` : 'e.g., USD Operations'}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateAccount} 
              disabled={!newCurrency || createAccount.isPending}
            >
              {createAccount.isPending ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
