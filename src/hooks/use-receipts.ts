import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export interface Receipt {
  id: string;
  receipt_number: string;
  invoice_id: string;
  payment_id: string;
  business_id: string;
  amount: number;
  currency: string;
  receipt_hash: string;
  verification_id: string;
  issuer_snapshot: {
    name?: string;
    legal_name?: string;
    tax_id?: string;
    cac_number?: string;
    address?: Record<string, unknown>;
    contact_email?: string;
    contact_phone?: string;
    logo_url?: string;
    jurisdiction?: string;
    is_vat_registered?: boolean;
    vat_registration_number?: string;
  };
  payer_snapshot: {
    name?: string;
    email?: string;
    phone?: string;
    tax_id?: string;
    cac_number?: string;
    client_type?: string;
    contact_person?: string;
    address?: Record<string, unknown>;
  };
  invoice_snapshot: {
    invoice_number?: string;
    total_amount?: number;
    issue_date?: string;
    due_date?: string;
    currency?: string;
  };
  payment_snapshot: {
    payment_method?: string;
    payment_reference?: string;
    payment_date?: string;
    notes?: string;
  };
  issued_at: string;
  retention_locked_until: string;
  created_at: string;
}

// Fetch all receipts for current business
export function useReceipts() {
  const { currentBusiness } = useBusiness();

  return useQuery({
    queryKey: ['receipts', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return data as Receipt[];
    },
    enabled: !!currentBusiness?.id,
  });
}

// Fetch single receipt by ID
export function useReceipt(receiptId: string | undefined) {
  return useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: async () => {
      if (!receiptId) return null;

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .maybeSingle();

      if (error) throw error;
      return data as Receipt | null;
    },
    enabled: !!receiptId,
  });
}

// Fetch receipt by payment ID
export function useReceiptByPayment(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['receipt', 'payment', paymentId],
    queryFn: async () => {
      if (!paymentId) return null;

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('payment_id', paymentId)
        .maybeSingle();

      if (error) throw error;
      return data as Receipt | null;
    },
    enabled: !!paymentId,
  });
}

// Fetch all receipts for an invoice
export function useReceiptsByInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['receipts', 'invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return data as Receipt[];
    },
    enabled: !!invoiceId,
  });
}

// Download receipt PDF
export function useDownloadReceiptPdf() {
  return useMutation({
    mutationFn: async ({ receiptId, receiptNumber }: { receiptId: string; receiptNumber: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('generate-receipt-pdf', {
        body: { receipt_id: receiptId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate PDF');
      }

      const { pdf, filename } = response.data;
      
      if (!pdf) {
        throw new Error('No PDF data returned');
      }

      // Convert base64 to blob
      const byteCharacters = atob(pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${receiptNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Receipt PDF downloaded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to download PDF: ${error.message}`);
    },
  });
}

// Verify receipt (public)
export async function verifyReceipt(verificationId: string) {
  const response = await supabase.functions.invoke('verify-receipt', {
    body: null,
    method: 'GET',
  });
  
  // Since we can't pass query params through invoke, we'll use fetch directly
  const url = `https://skcxogeaerudoadluexz.supabase.co/functions/v1/verify-receipt?verification_id=${verificationId}`;
  
  const fetchResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!fetchResponse.ok) {
    const errorData = await fetchResponse.json();
    throw new Error(errorData.error || 'Verification failed');
  }

  return fetchResponse.json();
}

// Hook for verifying receipt
export function useVerifyReceipt(verificationId: string | undefined) {
  return useQuery({
    queryKey: ['verify-receipt', verificationId],
    queryFn: async () => {
      if (!verificationId) return null;
      return verifyReceipt(verificationId);
    },
    enabled: !!verificationId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
