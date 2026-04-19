import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches paid deposit invoices for a given business+client+currency
 * that have NOT yet been consumed by a final invoice.
 *
 * Used by the Final-Invoice picker so users can select which deposit
 * to "consume" when creating a final invoice.
 */
export function useEligibleDepositInvoices(
  businessId: string | undefined,
  clientId: string | undefined,
  currency: string | undefined,
  excludeInvoiceId?: string,
) {
  return useQuery({
    queryKey: ['eligible-deposit-invoices', businessId, clientId, currency, excludeInvoiceId],
    queryFn: async () => {
      if (!businessId || !clientId || !currency) return [];

      // 1. Fetch all deposit invoices for this business+client+currency
      // that are issued or paid (not draft or voided)
      const { data: deposits, error: depErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, amount_paid, currency, issued_at, status, deposit_percent')
        .eq('business_id', businessId)
        .eq('client_id', clientId)
        .eq('currency', currency)
        .eq('kind', 'deposit')
        .in('status', ['issued', 'paid', 'sent', 'viewed'])
        .order('issued_at', { ascending: false });

      if (depErr) throw depErr;
      if (!deposits || deposits.length === 0) return [];

      // 2. Find which of those already have a final invoice consuming them
      const depositIds = deposits.map((d) => d.id);
      const { data: consumed, error: conErr } = await supabase
        .from('invoices')
        .select('parent_invoice_id, id')
        .in('parent_invoice_id', depositIds);

      if (conErr) throw conErr;

      const consumedIds = new Set(
        (consumed || [])
          .filter((c) => c.id !== excludeInvoiceId) // allow re-selecting current invoice's existing parent
          .map((c) => c.parent_invoice_id as string),
      );

      // 3. Return only deposits not yet consumed
      return deposits.filter((d) => !consumedIds.has(d.id));
    },
    enabled: !!businessId && !!clientId && !!currency,
  });
}
