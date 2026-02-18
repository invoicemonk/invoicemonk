import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  useCreateProductService,
  useUpdateProductService,
  ProductService,
  CreateProductServiceInput,
} from '@/hooks/use-products-services';

const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['product', 'service']),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    defaultPrice: z.number().min(0, 'Price must be 0 or greater'),
    taxApplicable: z.boolean().default(false),
    taxRate: z.number().min(0).max(100).nullable().optional(),
    trackInventory: z.boolean().default(false),
    stockQuantity: z.number().int().min(0).nullable().optional(),
    lowStockThreshold: z.number().int().min(0).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'service') return !data.trackInventory;
      return true;
    },
    { message: 'Services cannot track inventory', path: ['trackInventory'] }
  );

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: ProductService | null;
}

export function ProductServiceDialog({ open, onOpenChange, editItem }: Props) {
  const { currentBusiness } = useBusiness();
  const createMutation = useCreateProductService();
  const updateMutation = useUpdateProductService();
  const isEdit = !!editItem;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'service',
      description: '',
      sku: '',
      category: '',
      defaultPrice: 0,
      taxApplicable: false,
      taxRate: null,
      trackInventory: false,
      stockQuantity: null,
      lowStockThreshold: null,
    },
  });

  const type = watch('type');
  const taxApplicable = watch('taxApplicable');
  const trackInventory = watch('trackInventory');

  // When type switches to service, reset inventory fields
  useEffect(() => {
    if (type === 'service') {
      setValue('trackInventory', false);
      setValue('stockQuantity', null);
      setValue('lowStockThreshold', null);
    }
  }, [type, setValue]);

  // Populate form when editing
  useEffect(() => {
    if (editItem) {
      reset({
        name: editItem.name,
        type: editItem.type,
        description: editItem.description || '',
        sku: editItem.sku || '',
        category: editItem.category || '',
        defaultPrice: editItem.defaultPrice,
        taxApplicable: editItem.taxApplicable,
        taxRate: editItem.taxRate,
        trackInventory: editItem.trackInventory,
        stockQuantity: editItem.stockQuantity,
        lowStockThreshold: editItem.lowStockThreshold,
      });
    } else {
      reset({
        name: '',
        type: 'service',
        description: '',
        sku: '',
        category: '',
        defaultPrice: 0,
        taxApplicable: false,
        taxRate: null,
        trackInventory: false,
        stockQuantity: null,
        lowStockThreshold: null,
      });
    }
  }, [editItem, open, reset]);

  const onSubmit = async (data: FormData) => {
    const input: CreateProductServiceInput = {
      name: data.name,
      type: data.type,
      description: data.description || null,
      sku: data.sku || null,
      category: data.category || null,
      defaultPrice: data.defaultPrice,
      taxApplicable: data.taxApplicable,
      taxRate: data.taxApplicable ? (data.taxRate ?? null) : null,
      trackInventory: data.type === 'service' ? false : data.trackInventory,
      stockQuantity: data.type === 'product' && data.trackInventory ? (data.stockQuantity ?? null) : null,
      lowStockThreshold: data.type === 'product' && data.trackInventory ? (data.lowStockThreshold ?? null) : null,
    };

    if (isEdit && editItem) {
      await updateMutation.mutateAsync({ id: editItem.id, updates: input });
    } else {
      await createMutation.mutateAsync(input);
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveLabel = type === 'product' ? 'Save Product' : 'Save Service';
  const currency = currentBusiness?.default_currency || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit' : 'Add'} Product or Service</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the details for this item.' : 'Add a product or service to your catalog.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Basic Section */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="e.g. Website Design, Monthly Retainer" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === 'service' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setValue('type', 'service')}
                >
                  Service
                </Button>
                <Button
                  type="button"
                  variant={type === 'product' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setValue('type', 'product')}
                >
                  Product
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Optional description..." rows={2} {...register('description')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" placeholder="e.g. SVC-001" {...register('sku')} />
                <p className="text-xs text-muted-foreground">Must be unique within this business</p>
                {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" placeholder="e.g. Design, Consulting" {...register('category')} />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultPrice">Default Price *</Label>
                <Input
                  id="defaultPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register('defaultPrice', { valueAsNumber: true })}
                />
                {errors.defaultPrice && <p className="text-sm text-destructive">{errors.defaultPrice.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                  <Badge variant="outline" className="font-mono">{currency}</Badge>
                  <span className="text-xs text-muted-foreground">inherited from business</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tax Applicable</Label>
                <p className="text-xs text-muted-foreground">Apply tax to this item</p>
              </div>
              <Switch
                checked={taxApplicable}
                onCheckedChange={(v) => {
                  setValue('taxApplicable', v);
                  if (!v) setValue('taxRate', null);
                }}
              />
            </div>

            {taxApplicable && (
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="e.g. 7.5"
                  {...register('taxRate', { valueAsNumber: true })}
                />
                {errors.taxRate && <p className="text-sm text-destructive">{errors.taxRate.message}</p>}
              </div>
            )}

            {/* Inventory Section — products only */}
            {type === 'product' && (
              <>
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inventory</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Track Inventory</Label>
                    <p className="text-xs text-muted-foreground">Monitor stock levels for this product</p>
                  </div>
                  <Switch
                    checked={trackInventory}
                    onCheckedChange={(v) => {
                      setValue('trackInventory', v);
                      if (!v) {
                        setValue('stockQuantity', null);
                        setValue('lowStockThreshold', null);
                      }
                    }}
                  />
                </div>

                {trackInventory && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stockQuantity">Stock Quantity</Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...register('stockQuantity', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lowStockThreshold">Low Stock Alert</Label>
                      <Input
                        id="lowStockThreshold"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 5"
                        {...register('lowStockThreshold', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saveLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
