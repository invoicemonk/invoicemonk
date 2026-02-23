import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegulatorySubmission {
  id: string;
  invoice_id: string;
  artifact_id: string;
  business_id: string;
  jurisdiction: string;
  regulator_code: string;
  submission_status: string;
  submission_reference: string | null;
  submission_response: Record<string, unknown> | null;
  submitted_at: string | null;
  resolved_at: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  created_by: string | null;
}

interface RegulatoryEvent {
  id: string;
  submission_id: string | null;
  invoice_id: string | null;
  business_id: string;
  event_type: string;
  event_payload: Record<string, unknown> | null;
  created_at: string;
}

export function useRegulatorySubmissions(invoiceId?: string) {
  return useQuery({
    queryKey: ['regulatory-submissions', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await (supabase as any)
        .from('regulator_submissions')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RegulatorySubmission[];
    },
    enabled: !!invoiceId,
  });
}

export function useRegulatoryEvents(submissionId?: string) {
  return useQuery({
    queryKey: ['regulatory-events', submissionId],
    queryFn: async () => {
      if (!submissionId) return [];
      const { data, error } = await (supabase as any)
        .from('regulatory_events')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as RegulatoryEvent[];
    },
    enabled: !!submissionId,
  });
}

export function useSubmitToRegulator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('submit-invoice-to-regulator', {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['regulatory-submissions', invoiceId] });
      if (data?.status === 'not_required') {
        toast.info('Regulatory submission not required for this jurisdiction');
      } else if (data?.status === 'already_exists') {
        toast.info('A submission already exists for this invoice');
      } else {
        toast.success('Regulatory submission created');
      }
    },
    onError: (error: Error) => {
      toast.error(`Submission failed: ${error.message}`);
    },
  });
}

export function useAdminSubmissionQueue() {
  return useQuery({
    queryKey: ['admin-submission-queue'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('submission_queue')
        .select('*, regulator_submissions(*)')
        .is('processed_at', null)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAdminSubmissionStats() {
  return useQuery({
    queryKey: ['admin-submission-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('regulator_submissions')
        .select('submission_status, jurisdiction');
      if (error) throw error;

      const submissions = (data || []) as Array<{ submission_status: string; jurisdiction: string }>;
      const statusCounts: Record<string, number> = {};
      const jurisdictionCounts: Record<string, number> = {};

      for (const s of submissions) {
        statusCounts[s.submission_status] = (statusCounts[s.submission_status] || 0) + 1;
        jurisdictionCounts[s.jurisdiction] = (jurisdictionCounts[s.jurisdiction] || 0) + 1;
      }

      return { statusCounts, jurisdictionCounts, total: submissions.length };
    },
  });
}
