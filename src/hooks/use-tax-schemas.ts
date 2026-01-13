import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TaxSchema {
  id: string;
  jurisdiction: string;
  version: string;
  name: string;
  rates: Record<string, number | boolean>;
  rules?: Record<string, unknown>;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  created_by: string | null;
  is_active: boolean;
}

// Fetch all tax schemas
export function useTaxSchemas(jurisdiction?: string) {
  return useQuery({
    queryKey: ['tax-schemas', jurisdiction],
    queryFn: async () => {
      let query = supabase
        .from('tax_schemas')
        .select('*')
        .order('jurisdiction', { ascending: true })
        .order('effective_from', { ascending: false });

      if (jurisdiction) {
        query = query.eq('jurisdiction', jurisdiction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TaxSchema[];
    },
  });
}

// Get active tax schema for a jurisdiction
export function useActiveTaxSchema(jurisdiction: string) {
  return useQuery({
    queryKey: ['active-tax-schema', jurisdiction],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('tax_schemas')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_until.is.null,effective_until.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as TaxSchema | null;
    },
    enabled: !!jurisdiction,
  });
}

// Create new tax schema version (admin only)
export function useCreateTaxSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schema: Omit<TaxSchema, 'id' | 'created_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('tax_schemas')
        .insert([{
          jurisdiction: schema.jurisdiction,
          version: schema.version,
          name: schema.name,
          rates: schema.rates as any,
          rules: schema.rules as any,
          effective_from: schema.effective_from,
          effective_until: schema.effective_until,
          is_active: schema.is_active,
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'SETTINGS_UPDATED',
        _entity_type: 'tax_schema',
        _entity_id: data.id,
        _metadata: { action: 'created', version: schema.version, jurisdiction: schema.jurisdiction },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-schemas'] });
      toast.success('Tax schema created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create tax schema');
      console.error('Create tax schema error:', error);
    },
  });
}

// Update tax schema (only effective dates and is_active - rates are immutable)
export function useUpdateTaxSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: { effective_until?: string; is_active?: boolean } 
    }) => {
      const { data, error } = await supabase
        .from('tax_schemas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'SETTINGS_UPDATED',
        _entity_type: 'tax_schema',
        _entity_id: id,
        _metadata: { action: 'updated', updates },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-schemas'] });
      toast.success('Tax schema updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update tax schema');
      console.error('Update tax schema error:', error);
    },
  });
}
