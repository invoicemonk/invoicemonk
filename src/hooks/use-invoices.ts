import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { sanitizeErrorMessage } from '@/lib/error-utils';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Invoice = Tables<'invoices'> & {
  clients?: Tables<'clients'> | null;
  invoice_items?: Tables<'invoice_items'>[];
};

export type InvoiceItem = Tables<'invoice_items'>;
export type InvoiceInsert = TablesInsert<'invoices'>;
export type InvoiceItemInsert = TablesInsert<'invoice_items'>;

/**
 * Fetch all invoices for a business, optionally filtered by currency account.
 *
 * SECURITY: Relies on RLS policies for data isolation.
 * When businessId is provided, explicit filtering is applied.
 * When omitted, RLS ensures users only see invoices they have access to.
 * RLS policies: "Users can view their invoices" — (auth.uid() = user_id OR is_business_member(auth.uid(), business_id))
 */
export function useInvoices(businessId?: string, currencyAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoices', businessId || user?.id, currencyAccountId],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('invoices')
        .select(`
          *,
          clients (*)
        `)
        .order('created_at', { ascending: false });

      // If businessId is provided, filter by business
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      // Filter by currency account if provided
      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single invoice by ID.
 *
 * SECURITY: Single-record fetch by ID. RLS enforces ownership at database level.
 * UI layer should verify business membership via BusinessAccessGuard before rendering.
 */
export function useInvoice(invoiceId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId || !user) throw new Error('Invalid invoice ID or not authenticated');

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (*),
          invoice_items (*)
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      return data as Invoice;
    },
    enabled: !!invoiceId && !!user,
  });
}

// Create a new draft invoice
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      invoice, 
      items 
    }: { 
      invoice: Omit<InvoiceInsert, 'user_id' | 'invoice_number'>; 
      items: Omit<InvoiceItemInsert, 'invoice_id'>[] 
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Generate invoice number scoped to either business_id or user_id
      const isBusinessInvoice = !!invoice.business_id;
      
      // Query for highest existing invoice number within the correct scope
      let query = supabase
        .from('invoices')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(100); // Get more to find highest number reliably
      
      if (isBusinessInvoice) {
        query = query.eq('business_id', invoice.business_id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: existingInvoices, error: countError } = await query;

      if (countError) throw countError;

      // Find the highest invoice number
      let nextNumber = 1;
      if (existingInvoices && existingInvoices.length > 0) {
        const numbers = existingInvoices
          .map(inv => {
            const match = inv.invoice_number.match(/\d+$/);
            return match ? parseInt(match[0], 10) : 0;
          })
          .filter(n => !isNaN(n));
        
        if (numbers.length > 0) {
          nextNumber = Math.max(...numbers) + 1;
        }
      }

      const invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;

      // Create the invoice
      // Note: invoice_owner_check constraint requires either user_id OR business_id, not both
      const { data: createdInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          ...invoice,
          user_id: isBusinessInvoice ? null : user.id,
          business_id: invoice.business_id || null,
          invoice_number: invoiceNumber,
          status: 'draft',
          // Legacy FX fields - set to null for new records
          exchange_rate_to_primary: null,
          exchange_rate_snapshot: null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      if (items.length > 0) {
        const itemsWithInvoiceId = items.map((item, index) => ({
          ...item,
          invoice_id: createdInvoice.id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId);

        if (itemsError) throw itemsError;
      }

      // Log audit event (fire-and-forget - never block invoice creation)
      try {
        await supabase.rpc('log_audit_event', {
          _event_type: 'INVOICE_CREATED',
          _entity_type: 'invoice',
          _entity_id: createdInvoice.id,
          _user_id: user.id,
          _new_state: createdInvoice,
        });
      } catch (auditErr) {
        console.error('Audit log error (non-blocking):', auditErr);
      }

      return createdInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Invoice created',
        description: 'Your draft invoice has been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating invoice',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Update a draft invoice
export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      updates,
      items,
    }: {
      invoiceId: string;
      updates: TablesUpdate<'invoices'>;
      items?: Omit<InvoiceItemInsert, 'invoice_id'>[];
    }) => {
      // Get previous state for audit logging
      const { data: previousState } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      // Update the invoice
      const { data: updatedInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // If items provided, replace all items
      if (items) {
        // Delete existing items
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoiceId);

        // Insert new items
        if (items.length > 0) {
          const itemsWithInvoiceId = items.map((item, index) => ({
            ...item,
            invoice_id: invoiceId,
            sort_order: index,
          }));

          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsWithInvoiceId);

          if (itemsError) throw itemsError;
        }
      }

      // Log audit event for draft invoice changes (fire-and-forget)
      if (user && previousState) {
        try {
          await supabase.rpc('log_audit_event', {
            _event_type: 'INVOICE_UPDATED',
            _entity_type: 'invoice',
            _entity_id: invoiceId,
            _user_id: user.id,
            _business_id: updatedInvoice.business_id,
            _previous_state: previousState,
            _new_state: updatedInvoice,
          });
        } catch (auditErr) {
          console.error('Audit log error (non-blocking):', auditErr);
        }
      }

      return updatedInvoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', data.id] });
      toast({
        title: 'Invoice updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating invoice',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Issue an invoice (makes it immutable)
export function useIssueInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase
        .rpc('issue_invoice', { _invoice_id: invoiceId });

      if (error) {
        console.error('Issue invoice RPC error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const issued = Array.isArray(data) ? data[0] : data;
      queryClient.invalidateQueries({ queryKey: ['invoice', issued?.id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-limit-check'] });
      // Accounting cache invalidations
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-trend'] });
      toast({
        title: 'Invoice issued',
        description: 'This invoice is now immutable and cannot be modified.',
      });
    },
    onError: (error: Error) => {
      console.error('Issue invoice error:', error);
      toast({
        title: 'Error issuing invoice',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Void an invoice (creates credit note)
export function useVoidInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      invoiceId, 
      reason 
    }: { 
      invoiceId: string; 
      reason: string 
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Get the invoice first
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status === 'draft') throw new Error('Cannot void a draft invoice');
      if (invoice.status === 'voided') throw new Error('Invoice is already voided');

      // Generate credit note number
      const { data: existingCreditNotes } = await supabase
        .from('credit_notes')
        .select('credit_note_number')
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingCreditNotes && existingCreditNotes.length > 0) {
        const lastNumber = existingCreditNotes[0].credit_note_number;
        const match = lastNumber.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0], 10) + 1;
        }
      }

      const creditNoteNumber = `CN-${String(nextNumber).padStart(4, '0')}`;

      // Create credit note with currency snapshot from invoice (inherits currency_account_id via trigger)
      const { error: creditNoteError } = await supabase
        .from('credit_notes')
        .insert({
          original_invoice_id: invoiceId,
          credit_note_number: creditNoteNumber,
          amount: invoice.total_amount,
          currency: invoice.currency,
          currency_account_id: invoice.currency_account_id,
          reason,
          user_id: user.id,
          business_id: invoice.business_id,
          issued_by: user.id,
        });

      if (creditNoteError) throw creditNoteError;

      // Update invoice status to voided
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'voided',
          voided_at: new Date().toISOString(),
          voided_by: user.id,
          void_reason: reason,
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log audit event (fire-and-forget)
      try {
        await supabase.rpc('log_audit_event', {
          _event_type: 'INVOICE_VOIDED',
          _entity_type: 'invoice',
          _entity_id: invoiceId,
          _user_id: user.id,
          _previous_state: invoice,
          _new_state: updatedInvoice,
          _metadata: { reason, credit_note_number: creditNoteNumber },
        });
      } catch (auditErr) {
        console.error('Audit log error (non-blocking):', auditErr);
      }

      return updatedInvoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', data?.id] });
      // Credit notes + accounting invalidations
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-trend'] });
      toast({
        title: 'Invoice voided',
        description: 'A credit note has been created. The original invoice is preserved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error voiding invoice',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Record a payment via edge function (creates receipt automatically)
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentMethod,
      paymentReference,
      notes,
      paymentDate,
    }: {
      invoiceId: string;
      amount: number;
      paymentMethod?: string;
      paymentReference?: string;
      notes?: string;
      paymentDate?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('record-payment', {
        body: {
          invoice_id: invoiceId,
          amount,
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
          notes,
        },
      });

      if (error) throw new Error(error.message || 'Failed to record payment');
      if (!data?.success) throw new Error(data?.error || 'Failed to record payment');

      return {
        invoice_id: invoiceId,
        payment_id: data.payment?.id,
        receipt: data.receipt,
        invoice_status: data.invoice_status,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', data?.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['due-date-stats'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-trend'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipt'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Payment recorded',
        description: data?.receipt
          ? 'Payment recorded and receipt generated successfully.'
          : 'The payment has been recorded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error recording payment',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Delete a draft invoice
export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Get the invoice first to check status
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('status')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (invoice?.status !== 'draft') {
        throw new Error('Only draft invoices can be deleted');
      }

      // Delete invoice items first
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      // Delete the invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Invoice deleted',
        description: 'The draft invoice has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting invoice',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Check invoice limit
export function useCheckInvoiceLimit(businessId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-limit-check', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase.rpc('check_tier_limit_business', {
        _business_id: businessId,
        _feature: 'invoices_per_month',
      });

      if (error) throw error;
      return data as { allowed: boolean; current_count: number; limit_value: number | null };
    },
    enabled: !!businessId,
  });
}
