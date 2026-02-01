import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

export type Business = Tables<'businesses'>;

// Upload business logo
export function useUploadBusinessLogo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ businessId, file }: { businessId: string; file: File }) => {
      if (!user) throw new Error('Not authenticated');

      // Validate file
      const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a PNG, JPEG, SVG, or WebP image.');
      }
      if (file.size > 500 * 1024) {
        throw new Error('File too large. Maximum size is 500KB.');
      }

      // Create file path: userId/businessId/logo.extension
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${businessId}/logo.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('business-logos')
        .getPublicUrl(filePath);

      // Update business with logo URL
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ logo_url: publicUrl })
        .eq('id', businessId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      toast({
        title: 'Logo uploaded',
        description: 'Your business logo has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error uploading logo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete business logo
export function useDeleteBusinessLogo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (businessId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Get current business to find the logo path
      const { data: business } = await supabase
        .from('businesses')
        .select('logo_url')
        .eq('id', businessId)
        .single();

      if (business?.logo_url) {
        // Extract path from URL and delete from storage
        const url = new URL(business.logo_url);
        const path = url.pathname.split('/storage/v1/object/public/business-logos/')[1];
        if (path) {
          await supabase.storage.from('business-logos').remove([path]);
        }
      }

      // Clear logo URL in database
      const { error } = await supabase
        .from('businesses')
        .update({ logo_url: null })
        .eq('id', businessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      toast({
        title: 'Logo removed',
        description: 'Your business logo has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error removing logo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Fetch the current user's business (via business_members)
// Prioritizes the default business
export function useUserBusiness() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-business', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // First try to find user's default business
      const { data: defaultMembership, error: defaultError } = await supabase
        .from('business_members')
        .select(`
          business_id,
          role,
          business:businesses(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(10);

      if (defaultError) throw defaultError;

      // Find the default business first
      const defaultBiz = defaultMembership?.find(m => {
        const biz = m.business as unknown as Business & { is_default?: boolean };
        return biz?.is_default === true;
      });

      if (defaultBiz?.business) {
        return defaultBiz.business as Business;
      }

      // If no default, return the first membership
      if (defaultMembership && defaultMembership.length > 0 && defaultMembership[0].business) {
        return defaultMembership[0].business as Business;
      }

      // If no membership, check if user owns a business directly
      const { data: ownedBusiness, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('created_by', user.id)
        .order('is_default', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (ownedError) throw ownedError;

      return ownedBusiness as Business | null;
    },
    enabled: !!user,
  });
}

// Fetch all businesses for the current user
export function useUserBusinesses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-businesses', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('business_members')
        .select(`
          business_id,
          role,
          business:businesses(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      return (data || []).map(m => ({
        ...m,
        business: m.business as Business,
      }));
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
      business_type?: string | null;
      is_default?: boolean;
    }) => {

      if (!user) throw new Error('Not authenticated');

      // Create the business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          ...business,
          created_by: user.id,
          is_default: business.is_default ?? false,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Note: The database trigger `add_business_creator_as_owner` automatically
      // adds the creator as an owner in business_members, so we don't need to do it here.
      // The database trigger `on_business_created_subscription` automatically creates
      // a starter subscription for the new business.

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
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
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
