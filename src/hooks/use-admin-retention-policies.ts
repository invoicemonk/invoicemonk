import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface RetentionPolicy {
  id: string;
  entity_type: string;
  jurisdiction: string;
  retention_years: number;
  legal_basis: string | null;
  created_at: string | null;
}

export interface CreateRetentionPolicyInput {
  entity_type: string;
  jurisdiction: string;
  retention_years: number;
  legal_basis?: string;
}

export interface UpdateRetentionPolicyInput {
  id: string;
  entity_type?: string;
  jurisdiction?: string;
  retention_years?: number;
  legal_basis?: string | null;
}

export function useAdminRetentionPolicies(filters?: {
  jurisdiction?: string;
  entity_type?: string;
}) {
  return useQuery({
    queryKey: ['admin-retention-policies', filters],
    queryFn: async (): Promise<RetentionPolicy[]> => {
      let query = supabase
        .from('retention_policies')
        .select('*')
        .order('jurisdiction')
        .order('entity_type');

      if (filters?.jurisdiction) {
        query = query.eq('jurisdiction', filters.jurisdiction);
      }
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateRetentionPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRetentionPolicyInput) => {
      const { data, error } = await supabase
        .from('retention_policies')
        .insert({
          entity_type: input.entity_type,
          jurisdiction: input.jurisdiction,
          retention_years: input.retention_years,
          legal_basis: input.legal_basis || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-retention-policies'] });
      toast({
        title: 'Policy created',
        description: 'Retention policy has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating policy',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateRetentionPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRetentionPolicyInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('retention_policies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-retention-policies'] });
      toast({
        title: 'Policy updated',
        description: 'Retention policy has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating policy',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteRetentionPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('retention_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-retention-policies'] });
      toast({
        title: 'Policy deleted',
        description: 'Retention policy has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting policy',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Get unique jurisdictions and entity types for filters
export function useRetentionPolicyFilters() {
  return useQuery({
    queryKey: ['retention-policy-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retention_policies')
        .select('jurisdiction, entity_type');

      if (error) throw error;

      const jurisdictions = [...new Set(data?.map(p => p.jurisdiction) || [])].sort();
      const entityTypes = [...new Set(data?.map(p => p.entity_type) || [])].sort();

      return { jurisdictions, entityTypes };
    },
  });
}
