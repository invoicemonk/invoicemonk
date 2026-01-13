import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type AuditLog = Tables<'audit_logs'>;

// Fetch audit logs for the current user
export function useAuditLogs(options?: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', user?.id, options],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp_utc', { ascending: false });

      if (options?.entityType) {
        query = query.eq('entity_type', options.entityType);
      }

      if (options?.entityId) {
        query = query.eq('entity_id', options.entityId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!user,
  });
}

// Fetch audit logs for a specific invoice
export function useInvoiceAuditLogs(invoiceId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoice-audit-logs', invoiceId],
    queryFn: async () => {
      if (!invoiceId || !user) throw new Error('Invalid invoice ID or not authenticated');

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', 'invoice')
        .eq('entity_id', invoiceId)
        .order('timestamp_utc', { ascending: false });

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!invoiceId && !!user,
  });
}
