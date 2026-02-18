import { useState } from 'react';
import { Check, ChevronsUpDown, Package, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useProductsServices, ProductService } from '@/hooks/use-products-services';
import { useBusiness } from '@/contexts/BusinessContext';

interface Props {
  selectedId?: string | null;
  onSelect: (item: ProductService | null) => void;
}

export function ProductServiceCombobox({ selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { currentBusiness } = useBusiness();

  // Reads from cache — no extra DB calls per render
  const { data: allItems = [] } = useProductsServices(currentBusiness?.id);

  // Only show active items for new selections
  const activeItems = allItems.filter((i) => i.isActive);

  const filtered = search
    ? activeItems.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          (i.sku && i.sku.toLowerCase().includes(search.toLowerCase())) ||
          (i.category && i.category.toLowerCase().includes(search.toLowerCase()))
      )
    : activeItems;

  const selected = selectedId ? allItems.find((i) => i.id === selectedId) : null;

  const products = filtered.filter((i) => i.type === 'product');
  const services = filtered.filter((i) => i.type === 'service');

  const handleSelect = (item: ProductService) => {
    onSelect(item);
    setSearch('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 text-sm"
        >
          <span className="flex items-center gap-2 truncate">
            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {selected ? (
              <span className="truncate">{selected.name}</span>
            ) : (
              <span className="text-muted-foreground">Select a product or service (optional)</span>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
                className="rounded-sm hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, SKU, or category..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No active products or services found</CommandEmpty>
            {services.length > 0 && (
              <CommandGroup heading="Services">
                {services.map((item) => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item)}>
                    <Check
                      className={cn('mr-2 h-4 w-4 shrink-0', selectedId === item.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <span className="truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {item.currency} {item.defaultPrice.toFixed(2)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {products.length > 0 && (
              <CommandGroup heading="Products">
                {products.map((item) => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item)}>
                    <Check
                      className={cn('mr-2 h-4 w-4 shrink-0', selectedId === item.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <span className="truncate">{item.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.trackInventory && item.stockQuantity !== null && (
                          <Badge
                            variant={
                              item.lowStockThreshold !== null && item.stockQuantity <= item.lowStockThreshold
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {item.stockQuantity} in stock
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {item.currency} {item.defaultPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
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
