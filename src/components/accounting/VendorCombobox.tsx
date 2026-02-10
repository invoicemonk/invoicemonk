import { useState } from 'react';
import { Check, ChevronsUpDown, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useVendorSuggestions } from '@/hooks/use-vendor-suggestions';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';

interface VendorComboboxProps {
  value?: string;
  onChange: (value: string) => void;
}

export function VendorCombobox({ value, onChange }: VendorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount } = useCurrencyAccount();
  const { data: vendors = [] } = useVendorSuggestions(
    currentBusiness?.id,
    currentCurrencyAccount?.id
  );

  const filtered = search
    ? vendors.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : vendors;

  const showNewOption = search && !vendors.some(v => v.toLowerCase() === search.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className="truncate">
            {value || <span className="text-muted-foreground">Who did you pay?</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type new vendor..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search ? 'No matching vendors' : 'No vendors yet'}
            </CommandEmpty>
            {showNewOption && (
              <CommandGroup heading="New">
                <CommandItem
                  value={search}
                  onSelect={() => {
                    onChange(search);
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  <Store className="mr-2 h-4 w-4" />
                  Add "{search}"
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Recent vendors">
                {filtered.map(vendor => (
                  <CommandItem
                    key={vendor}
                    value={vendor}
                    onSelect={() => {
                      onChange(vendor);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === vendor ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {vendor}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
