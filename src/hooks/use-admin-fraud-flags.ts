import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FraudFlag {
  id: string;
  business_id: string;
  invoice_id: string | null;
  user_id: string | null;
  reason: string;
  severity: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  business_name?: string;
  invoice_number?: string;
}

export function useAdminFraudFlags(filters?: { resolved?: boolean; severity?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-fraud-flags', filters],
    queryFn: async () => {
      // Fetch fraud flags
      let q = supabase
        .from('fraud_flags' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.resolved !== undefined) {
        q = q.eq('resolved', filters.resolved);
      }
      if (filters?.severity) {
        q = q.eq('severity', filters.severity);
      }

      const { data, error } = await q;
      if (error) throw error;

      const flags = (data || []) as any[];

      // Enrich with business names and invoice numbers
      const businessIds = [...new Set(flags.map(f => f.business_id).filter(Boolean))];
      const invoiceIds = [...new Set(flags.map(f => f.invoice_id).filter(Boolean))];

      const [businessRes, invoiceRes] = await Promise.all([
        businessIds.length > 0
          ? supabase.from('businesses').select('id, name').in('id', businessIds)
          : { data: [] },
        invoiceIds.length > 0
          ? supabase.from('invoices').select('id, invoice_number').in('id', invoiceIds)
          : { data: [] },
      ]);

      const businessMap = new Map((businessRes.data || []).map(b => [b.id, b.name]));
      const invoiceMap = new Map((invoiceRes.data || []).map(i => [i.id, i.invoice_number]));

      return flags.map(f => ({
        ...f,
        business_name: businessMap.get(f.business_id) || 'Unknown',
        invoice_number: f.invoice_id ? invoiceMap.get(f.invoice_id) || null : null,
      })) as FraudFlag[];
    },
  });

  const resolveFlag = useMutation({
    mutationFn: async ({ flagId, resolved }: { flagId: string; resolved: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('fraud_flags' as any)
        .update({
          resolved,
          resolved_by: resolved ? user?.id : null,
          resolved_at: resolved ? new Date().toISOString() : null,
        } as any)
        .eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fraud-flags'] });
    },
  });

  return { ...query, resolveFlag };
}
