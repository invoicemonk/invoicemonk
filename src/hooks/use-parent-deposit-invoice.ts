import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch the deposit-invoice "parent" of a final invoice.
 *
 * Returns the minimal fields needed to render the
 * "Less: Deposit (INV-xxxx) — paid X" credit line on the
 * preview card / PDF / detail page, plus the verification_id
 * so we can link to the deposit's verify page.
 *
 * Returns null when the input id is not provided (i.e. the invoice
 * is a standard or deposit invoice, not a final).
 */
export function useParentDepositInvoice(parentInvoiceId: string | null | undefined) {
  return useQuery({
    queryKey: ['parent-deposit-invoice', parentInvoiceId],
    queryFn: async () => {
      if (!parentInvoiceId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, amount_paid, currency, deposit_percent, verification_id, status, issued_at')
        .eq('id', parentInvoiceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!parentInvoiceId,
    staleTime: 60_000,
  });
}

/**
 * Fetch the list of "final" invoices that consume a given deposit invoice.
 * Used on the deposit invoice's detail page to show "Consumed by: INV-xxxx".
 */
export function useChildFinalInvoices(depositInvoiceId: string | null | undefined) {
  return useQuery({
    queryKey: ['child-final-invoices', depositInvoiceId],
    queryFn: async () => {
      if (!depositInvoiceId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, amount_paid, currency, status, issued_at, verification_id')
        .eq('parent_invoice_id', depositInvoiceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!depositInvoiceId,
    staleTime: 60_000,
  });
}
