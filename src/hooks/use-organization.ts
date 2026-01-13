import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Business = Tables<'businesses'>;
type BusinessMember = Tables<'business_members'>;
type BusinessRole = 'owner' | 'admin' | 'member' | 'auditor';

// Fetch all organizations the user belongs to
export function useUserOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('business_members')
        .select(`
          *,
          business:businesses(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      return data.map(item => ({
        ...item,
        business: item.business as unknown as Business,
      }));
    },
    enabled: !!user,
  });
}

// Fetch organization details
export function useOrganizationDetails(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

// Fetch organization members
export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('business_members')
        .select(`
          *,
          profile:profiles(id, email, full_name, avatar_url)
        `)
        .eq('business_id', orgId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

// Create a new organization
export function useCreateOrganization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (business: Omit<TablesInsert<'businesses'>, 'created_by'>) => {
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

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('business_members')
        .insert({
          business_id: newBusiness.id,
          user_id: user.id,
          role: 'owner' as BusinessRole,
          accepted_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      return newBusiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create organization');
      console.error('Create organization error:', error);
    },
  });
}

// Update organization
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, updates }: { orgId: string; updates: TablesUpdate<'businesses'> }) => {
      const { data, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization', data.id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update organization');
      console.error('Update organization error:', error);
    },
  });
}

// Invite team member
export function useInviteTeamMember() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      email,
      role,
    }: {
      orgId: string;
      email: string;
      role: BusinessRole;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // First, find the user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          throw new Error('No user found with this email address');
        }
        throw profileError;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('business_members')
        .select('id')
        .eq('business_id', orgId)
        .eq('user_id', profile.id)
        .single();

      if (existingMember) {
        throw new Error('This user is already a member of this organization');
      }

      // Add as member
      const { data, error } = await supabase
        .from('business_members')
        .insert({
          business_id: orgId,
          user_id: profile.id,
          role,
          invited_by: user.id,
          invited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', variables.orgId] });
      toast.success('Team member invited successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to invite team member');
      console.error('Invite member error:', error);
    },
  });
}

// Update team member role
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      orgId,
      newRole,
    }: {
      memberId: string;
      orgId: string;
      newRole: BusinessRole;
    }) => {
      const { data, error } = await supabase
        .from('business_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', variables.orgId] });
      toast.success('Member role updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update member role');
      console.error('Update role error:', error);
    },
  });
}

// Remove team member
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, orgId }: { memberId: string; orgId: string }) => {
      const { error } = await supabase
        .from('business_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', variables.orgId] });
      toast.success('Team member removed successfully');
    },
    onError: (error) => {
      toast.error('Failed to remove team member');
      console.error('Remove member error:', error);
    },
  });
}

// Fetch organization invoices
export function useOrganizationInvoices(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization-invoices', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, email)
        `)
        .eq('business_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

// Fetch organization audit logs
export function useOrganizationAuditLogs(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization-audit-logs', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('business_id', orgId)
        .order('timestamp_utc', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

// Fetch organization stats
export function useOrganizationStats(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization-stats', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      // Fetch invoice stats
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('status, total_amount, amount_paid')
        .eq('business_id', orgId);

      if (invoicesError) throw invoicesError;

      // Fetch member count
      const { count: memberCount, error: memberError } = await supabase
        .from('business_members')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', orgId);

      if (memberError) throw memberError;

      // Fetch client count
      const { count: clientCount, error: clientError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', orgId);

      if (clientError) throw clientError;

      // Calculate stats
      const totalInvoices = invoices?.length || 0;
      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const totalPaid = invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid), 0) || 0;
      const totalOutstanding = totalRevenue - totalPaid;
      const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0;
      const draftInvoices = invoices?.filter(inv => inv.status === 'draft').length || 0;
      const issuedInvoices = invoices?.filter(inv => ['issued', 'sent', 'viewed'].includes(inv.status)).length || 0;

      return {
        totalInvoices,
        totalRevenue,
        totalPaid,
        totalOutstanding,
        paidInvoices,
        draftInvoices,
        issuedInvoices,
        memberCount: memberCount || 0,
        clientCount: clientCount || 0,
      };
    },
    enabled: !!orgId,
  });
}
