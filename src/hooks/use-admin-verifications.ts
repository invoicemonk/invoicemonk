import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface VerificationQueueItem {
  id: string;
  name: string;
  legal_name: string | null;
  entity_type: string;
  verification_status: string;
  document_verification_status: string;
  verification_submitted_at: string | null;
  verification_notes: string | null;
  rejection_reason: string | null;
  jurisdiction: string | null;
  created_at: string;
  document_count: number;
}

export interface VerificationDocument {
  id: string;
  business_id: string;
  uploaded_by: string;
  document_type: string;
  file_url: string;
  file_path: string | null;
  file_name: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export function useVerificationQueue(statusFilter?: string | null) {
  return useQuery({
    queryKey: ['admin-verification-queue', statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_verification_queue', {
        _status_filter: statusFilter || null,
      });
      if (error) throw error;
      return (data || []) as VerificationQueueItem[];
    },
  });
}

export function useAdminBusinessDocuments(businessId: string | undefined) {
  return useQuery({
    queryKey: ['admin-business-documents', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase.rpc('admin_get_business_documents', {
        _business_id: businessId,
      });
      if (error) throw error;
      return (data || []) as VerificationDocument[];
    },
    enabled: !!businessId,
  });
}

export function useAdminVerificationAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      businessId,
      status,
      source,
      reason,
      notes,
    }: {
      businessId: string;
      status: string;
      source?: string;
      reason?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.rpc('admin_set_verification', {
        _business_id: businessId,
        _status: status,
        _source: source || null,
        _reason: reason || null,
        _notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-verification-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-business-documents'] });
      toast({ title: 'Verification updated', description: 'Business verification status has been updated.' });
      // Fire-and-forget: notify business owner of outcome
      const notifType = variables.status === 'verified' ? 'approved' : variables.status;
      if (['approved', 'rejected', 'requires_action'].includes(notifType)) {
        supabase.functions.invoke('send-verification-notification', {
          body: {
            type: notifType,
            business_id: variables.businessId,
            reason: variables.reason || variables.notes || undefined,
          },
        }).catch(() => {});
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
    },
  });
}
