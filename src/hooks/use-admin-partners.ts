import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAdminPartners() {
  return useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_partners')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      user_id: string;
      name: string;
      email: string;
      commission_rate?: number;
    }) => {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('Not authenticated');

      // Create partner profile
      const { data: partner, error } = await supabase
        .from('referral_partners')
        .insert({
          user_id: params.user_id,
          name: params.name,
          email: params.email,
          commission_rate: params.commission_rate ?? 0.20,
          created_by: authUser.user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Add partner role to user_roles
      await supabase.from('user_roles').insert({
        user_id: params.user_id,
        role: 'partner' as any,
      });

      // Audit log
      await supabase.rpc('log_audit_event', {
        _event_type: 'PARTNER_CREATED',
        _entity_type: 'referral_partner',
        _entity_id: partner.id,
        _user_id: authUser.user.id,
        _metadata: { partner_name: params.name, partner_email: params.email },
      });

      return partner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
    },
  });
}

export function useUpdatePartnerStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: authUser } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('referral_partners')
        .update({ status: status as 'active' | 'paused' | 'suspended' })
        .eq('id', id);
      if (error) throw error;

      // Audit log
      if (authUser?.user) {
        await supabase.rpc('log_audit_event', {
          _event_type: 'PARTNER_UPDATED',
          _entity_type: 'referral_partner',
          _entity_id: id,
          _user_id: authUser.user.id,
          _metadata: { new_status: status },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
    },
  });
}

export function useAdminPartnerReferrals(partnerId?: string) {
  return useQuery({
    queryKey: ['admin-partner-referrals', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('partner_id', partnerId)
        .order('attributed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });
}

export function useAdminPartnerCommissions(partnerId?: string) {
  return useQuery({
    queryKey: ['admin-partner-commissions', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('commissions')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });
}

export function useCreatePayoutBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      partner_id: string;
      currency: string;
      commission_ids: string[];
      total_amount: number;
      payment_method?: string;
      payment_reference?: string;
      notes?: string;
    }) => {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('Not authenticated');

      // Create the payout batch
      const { data: batch, error: batchError } = await supabase
        .from('payout_batches')
        .insert({
          partner_id: params.partner_id,
          total_amount: params.total_amount,
          currency: params.currency,
          payment_method: params.payment_method,
          payment_reference: params.payment_reference,
          notes: params.notes,
          created_by: authUser.user.id,
        })
        .select()
        .single();
      if (batchError) throw batchError;

      // Assign commissions to this batch
      for (const commId of params.commission_ids) {
        await supabase
          .from('commissions')
          .update({ payout_batch_id: batch.id })
          .eq('id', commId);
      }

      // Audit log
      await supabase.rpc('log_audit_event', {
        _event_type: 'PAYOUT_CREATED',
        _entity_type: 'payout_batch',
        _entity_id: batch.id,
        _user_id: authUser.user.id,
        _metadata: {
          partner_id: params.partner_id,
          currency: params.currency,
          total_amount: params.total_amount,
          commission_count: params.commission_ids.length,
        },
      });

      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      queryClient.invalidateQueries({ queryKey: ['admin-partner-commissions'] });
    },
  });
}

export function useMarkPayoutPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      batchId,
      paymentReference,
    }: {
      batchId: string;
      paymentReference?: string;
    }) => {
      const { data: authUser } = await supabase.auth.getUser();

      // Update batch status
      const { error: batchError } = await supabase
        .from('payout_batches')
        .update({
          status: 'paid' as const,
          paid_at: new Date().toISOString(),
          payment_reference: paymentReference,
        })
        .eq('id', batchId);
      if (batchError) throw batchError;

      // Update all commissions in this batch
      const { error: commError } = await supabase
        .from('commissions')
        .update({
          status: 'paid' as const,
          paid_at: new Date().toISOString(),
        })
        .eq('payout_batch_id', batchId);
      if (commError) throw commError;

      // Audit log
      if (authUser?.user) {
        await supabase.rpc('log_audit_event', {
          _event_type: 'PAYOUT_PAID',
          _entity_type: 'payout_batch',
          _entity_id: batchId,
          _user_id: authUser.user.id,
          _metadata: { payment_reference: paymentReference },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      queryClient.invalidateQueries({ queryKey: ['admin-partner-commissions'] });
    },
  });
}
