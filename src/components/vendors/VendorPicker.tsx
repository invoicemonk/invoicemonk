import { useState } from 'react';
import { Check, ChevronsUpDown, Store, Loader2 } from 'lucide-react';
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
import { useVendors, findOrCreateVendor, type Vendor } from '@/hooks/use-vendors';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface VendorPickerProps {
  value?: string;            // legacy vendor text snapshot
  vendorId?: string | null;  // canonical FK
  onChange: (next: { vendor_id: string | null; vendor: string }) => void;
  placeholder?: string;
}

/**
 * Real vendor picker backed by the `vendors` table.
 * Always emits both vendor_id (canonical FK) and vendor text (snapshot for back-compat).
 */
export function VendorPicker({ value, vendorId, onChange, placeholder = 'Who did you pay?' }: VendorPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { currentBusiness } = useBusiness();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vendors = [], isLoading } = useVendors(currentBusiness?.id);

  const norm = search.trim().toLowerCase();
  const filtered = norm
    ? vendors.filter((v) => v.name.toLowerCase().includes(norm))
    : vendors;

  const exactMatch = vendors.find((v) => v.name.trim().toLowerCase() === norm);
  const showNewOption = norm.length > 0 && !exactMatch;

  const selectExisting = (v: Vendor) => {
    onChange({ vendor_id: v.id, vendor: v.name });
    setSearch('');
    setOpen(false);
  };

  const createAndSelect = async () => {
    if (!currentBusiness?.id || !user || !search.trim()) return;
    setCreating(true);
    try {
      const created = await findOrCreateVendor(currentBusiness.id, search.trim(), user.id);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onChange({ vendor_id: created.id, vendor: created.name });
      setSearch('');
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create vendor';
      toast({ title: 'Vendor not added', description: message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className="truncate">
            {value || <span className="text-muted-foreground">{placeholder}</span>}
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
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {search ? 'No matching vendors' : 'No vendors yet'}
                </CommandEmpty>
                {showNewOption && (
                  <CommandGroup heading="New">
                    <CommandItem value={`__new__${search}`} onSelect={createAndSelect} disabled={creating}>
                      {creating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Store className="mr-2 h-4 w-4" />
                      )}
                      Add "{search.trim()}"
                    </CommandItem>
                  </CommandGroup>
                )}
                {filtered.length > 0 && (
                  <CommandGroup heading="Vendors">
                    {filtered.map((v) => (
                      <CommandItem
                        key={v.id}
                        value={v.id}
                        onSelect={() => selectExisting(v)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            vendorId === v.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {v.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
