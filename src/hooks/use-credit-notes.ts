import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type CreditNote = Tables<'credit_notes'> & {
  original_invoice?: {
    invoice_number: string;
    total_amount: number;
    currency: string;
    clients?: {
      name: string;
    } | null;
  } | null;
};

// Fetch all credit notes for a specific business
export function useCreditNotes(businessId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['credit-notes', businessId, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('credit_notes')
        .select(`
          *,
          original_invoice:invoices (
            invoice_number,
            total_amount,
            currency,
            clients (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CreditNote[];
    },
    enabled: !!user,
  });
}

// Fetch a single credit note by ID
export function useCreditNote(creditNoteId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['credit-note', creditNoteId],
    queryFn: async () => {
      if (!creditNoteId || !user) throw new Error('Invalid credit note ID or not authenticated');

      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          original_invoice:invoices (
            id,
            invoice_number,
            total_amount,
            currency,
            issue_date,
            issued_at,
            clients (name, email),
            issuer_snapshot,
            recipient_snapshot
          )
        `)
        .eq('id', creditNoteId)
        .single();

      if (error) throw error;
      return data as CreditNote & {
        original_invoice?: {
          id: string;
          invoice_number: string;
          total_amount: number;
          currency: string;
          issue_date: string | null;
          issued_at: string | null;
          clients?: { name: string; email: string | null } | null;
          issuer_snapshot: unknown;
          recipient_snapshot: unknown;
        } | null;
      };
    },
    enabled: !!creditNoteId && !!user,
  });
}

// Fetch credit note by original invoice ID
export function useCreditNoteByInvoice(invoiceId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['credit-note-by-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId || !user) return null;

      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('original_invoice_id', invoiceId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId && !!user,
  });
}
