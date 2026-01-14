import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Client = Tables<'clients'>;
export type ClientInsert = TablesInsert<'clients'>;
export type ClientUpdate = TablesUpdate<'clients'>;

// Fetch all clients for the current user
export function useClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });
}

// Fetch a single client by ID
export function useClient(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId || !user) throw new Error('Invalid client ID or not authenticated');

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as Client;
    },
    enabled: !!clientId && !!user,
  });
}

// Fetch all invoices for a specific client
export function useClientInvoices(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-invoices', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!clientId,
  });
}

// Create a new client
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (client: Omit<ClientInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...client,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'CLIENT_CREATED',
        _entity_type: 'client',
        _entity_id: data.id,
        _user_id: user.id,
        _new_state: data,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: 'Client created',
        description: 'The client has been added successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update a client
export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      updates 
    }: { 
      clientId: string; 
      updates: ClientUpdate 
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Get previous state
      const { data: previousState } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'CLIENT_UPDATED',
        _entity_type: 'client',
        _entity_id: clientId,
        _user_id: user.id,
        _previous_state: previousState,
        _new_state: data,
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', data.id] });
      toast({
        title: 'Client updated',
        description: 'The client has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete a client
export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'CLIENT_UPDATED',
        _entity_type: 'client',
        _entity_id: clientId,
        _user_id: user.id,
        _metadata: { action: 'deleted' },
      });

      return clientId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: 'Client deleted',
        description: 'The client has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch clients by business ID (for org pages)
export function useOrgClients(businessId: string | undefined) {
  return useQuery({
    queryKey: ['clients', 'org', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!businessId,
  });
}
