import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

export type Business = Tables<'businesses'>;

// Fetch the current user's business (via business_members)
export function useUserBusiness() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-business', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // First check if user is a member of any business
      const { data: membership, error: memberError } = await supabase
        .from('business_members')
        .select('business_id, role, businesses(*)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (membership?.businesses) {
        return membership.businesses as Business;
      }

      // If no membership, check if user owns a business directly
      const { data: ownedBusiness, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('created_by', user.id)
        .limit(1)
        .maybeSingle();

      if (ownedError) throw ownedError;

      return ownedBusiness as Business | null;
    },
    enabled: !!user,
  });
}

// Create a new business for the user
export function useCreateBusiness() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (business: {
      name: string;
      legal_name?: string | null;
      jurisdiction: string;
      tax_id?: string | null;
      contact_email?: string | null;
      contact_phone?: string | null;
      address?: Record<string, string | undefined> | null;
      invoice_prefix?: string | null;
    }) => {

      if (!user) throw new Error('Not authenticated');

      // Create the business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          ...business,
          created_by: user.id,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Note: The database trigger `add_business_creator_as_owner` automatically
      // adds the creator as an owner in business_members, so we don't need to do it here.

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'BUSINESS_CREATED',
        _entity_type: 'business',
        _entity_id: newBusiness.id,
        _user_id: user.id,
        _new_state: newBusiness,
      });

      return newBusiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      toast({
        title: 'Business created',
        description: 'Your business profile has been created.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating business',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update an existing business
export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      updates 
    }: { 
      businessId: string; 
      updates: TablesUpdate<'businesses'>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Get current state for audit log
      const { data: currentBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      const { data: updatedBusiness, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', businessId)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'BUSINESS_UPDATED',
        _entity_type: 'business',
        _entity_id: businessId,
        _user_id: user.id,
        _previous_state: currentBusiness,
        _new_state: updatedBusiness,
      });

      return updatedBusiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      toast({
        title: 'Profile saved',
        description: 'Your business profile has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving profile',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
