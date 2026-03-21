import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyPartnerApplication() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-partner-application', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('partner_applications' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
  });
}

export function useSubmitPartnerApplication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { name: string; email: string; motivation?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('partner_applications' as any)
        .insert({
          user_id: user.id,
          name: params.name,
          email: params.email,
          motivation: params.motivation || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-partner-application'] });
    },
  });
}

// Admin hooks
export function useAdminPartnerApplications() {
  return useQuery({
    queryKey: ['admin-partner-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_applications' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useApprovePartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (application: any) => {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('Not authenticated');

      // Create partner profile
      const { data: partner, error: partnerErr } = await supabase
        .from('referral_partners')
        .insert({
          user_id: application.user_id,
          name: application.name,
          email: application.email,
          commission_rate: 0.20,
          created_by: authUser.user.id,
        })
        .select()
        .single();
      if (partnerErr) throw partnerErr;

      // Add partner role
      await supabase.from('user_roles').insert({
        user_id: application.user_id,
        role: 'partner' as any,
      });

      // Update application status
      await supabase
        .from('partner_applications' as any)
        .update({
          status: 'approved',
          reviewed_by: authUser.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', application.id);

      // Send in-app notification to the approved partner
      await supabase.from('notifications').insert({
        user_id: application.user_id,
        type: 'partner',
        title: '🎉 Partner Application Approved!',
        message: 'Your partner application has been approved. Visit the Partner Portal to set up your payout method and create your first referral link.',
        entity_type: 'referral_partner',
        entity_id: partner.id,
      });

      // Audit log
      await supabase.rpc('log_audit_event', {
        _event_type: 'PARTNER_CREATED',
        _entity_type: 'referral_partner',
        _entity_id: partner.id,
        _user_id: authUser.user.id,
        _metadata: { source: 'application', partner_name: application.name },
      });

      return partner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-applications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
    },
  });
}

export function useRejectPartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('partner_applications' as any)
        .update({
          status: 'rejected',
          reviewed_by: authUser.user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-applications'] });
    },
  });
}
