import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from '@/hooks/use-toast';

export interface ProductService {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  type: 'product' | 'service';
  sku: string | null;
  category: string | null;
  defaultPrice: number;
  currency: string;
  taxApplicable: boolean;
  taxRate: number | null;
  trackInventory: boolean;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  isActive: boolean;
  inventoryLastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): ProductService {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    type: row.type,
    sku: row.sku,
    category: row.category,
    defaultPrice: Number(row.default_price),
    currency: row.currency,
    taxApplicable: row.tax_applicable,
    taxRate: row.tax_rate !== null ? Number(row.tax_rate) : null,
    trackInventory: row.track_inventory,
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    isActive: row.is_active,
    inventoryLastUpdatedAt: row.inventory_last_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch all products/services for a business.
 * Cached for 5 minutes — used as the single source for all client-side filtering.
 */
export function useProductsServices(businessId?: string) {
  return useQuery({
    queryKey: ['products-services', businessId],
    queryFn: async (): Promise<ProductService[]> => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface CreateProductServiceInput {
  name: string;
  type: 'product' | 'service';
  description?: string | null;
  sku?: string | null;
  category?: string | null;
  defaultPrice: number;
  taxApplicable: boolean;
  taxRate?: number | null;
  trackInventory: boolean;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
}

export interface UpdateProductServiceInput extends Partial<CreateProductServiceInput> {
  isActive?: boolean;
}

export function useCreateProductService() {
  const queryClient = useQueryClient();
  const { currentBusiness } = useBusiness();

  return useMutation({
    mutationFn: async (input: CreateProductServiceInput) => {
      if (!currentBusiness) throw new Error('No business selected');
      const currency = currentBusiness.default_currency;
      if (!currency) throw new Error('Business has no default currency set');

      // Enforce service inventory rules at app layer (mirrors DB constraint)
      const isService = input.type === 'service';

      const { data, error } = await supabase
        .from('products_services')
        .insert({
          business_id: currentBusiness.id,
          name: input.name,
          type: input.type,
          description: input.description || null,
          sku: input.sku || null,
          category: input.category || null,
          default_price: input.defaultPrice,
          currency,
          tax_applicable: input.taxApplicable,
          tax_rate: input.taxApplicable ? (input.taxRate ?? null) : null,
          track_inventory: isService ? false : input.trackInventory,
          stock_quantity: isService ? null : (input.trackInventory ? (input.stockQuantity ?? null) : null),
          low_stock_threshold: isService ? null : (input.trackInventory ? (input.lowStockThreshold ?? null) : null),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-services', data.businessId] });
      toast({ title: `${data.type === 'product' ? 'Product' : 'Service'} created`, description: `${data.name} has been added.` });
    },
    onError: (error: any) => {
      const isDuplicateSku = error?.code === '23505';
      toast({
        title: isDuplicateSku ? 'SKU already in use' : 'Error creating item',
        description: isDuplicateSku
          ? 'This SKU is already in use by another product or service.'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProductService() {
  const queryClient = useQueryClient();
  const { currentBusiness } = useBusiness();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateProductServiceInput }) => {
      if (!currentBusiness) throw new Error('No business selected');

      const isService = updates.type === 'service';
      const updatePayload: Record<string, any> = {};

      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.type !== undefined) updatePayload.type = updates.type;
      if (updates.description !== undefined) updatePayload.description = updates.description || null;
      if (updates.sku !== undefined) updatePayload.sku = updates.sku || null;
      if (updates.category !== undefined) updatePayload.category = updates.category || null;
      if (updates.defaultPrice !== undefined) updatePayload.default_price = updates.defaultPrice;
      if (updates.taxApplicable !== undefined) {
        updatePayload.tax_applicable = updates.taxApplicable;
        if (!updates.taxApplicable) updatePayload.tax_rate = null;
      }
      if (updates.taxRate !== undefined) updatePayload.tax_rate = updates.taxRate;
      if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;

      // Inventory fields — enforce service constraint
      if (isService) {
        updatePayload.track_inventory = false;
        updatePayload.stock_quantity = null;
        updatePayload.low_stock_threshold = null;
      } else {
        if (updates.trackInventory !== undefined) updatePayload.track_inventory = updates.trackInventory;
        if (updates.stockQuantity !== undefined) updatePayload.stock_quantity = updates.stockQuantity;
        if (updates.lowStockThreshold !== undefined) updatePayload.low_stock_threshold = updates.lowStockThreshold;
      }

      // currency is immutable — never updated

      const { data, error } = await supabase
        .from('products_services')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-services', data.businessId] });
      toast({ title: 'Item updated', description: `${data.name} has been saved.` });
    },
    onError: (error: any) => {
      const isDuplicateSku = error?.code === '23505';
      toast({
        title: isDuplicateSku ? 'SKU already in use' : 'Error updating item',
        description: isDuplicateSku
          ? 'This SKU is already in use by another product or service.'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useArchiveProductService() {
  const queryClient = useQueryClient();
  const { currentBusiness } = useBusiness();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('products_services')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-services', currentBusiness?.id] });
      toast({ title: 'Status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
