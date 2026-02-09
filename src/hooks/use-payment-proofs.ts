import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

export type PaymentProof = Tables<'payment_proofs'>;

export function usePaymentProofs(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['payment-proofs', paymentId],
    queryFn: async () => {
      if (!paymentId) return [];
      const { data, error } = await supabase
        .from('payment_proofs')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PaymentProof[];
    },
    enabled: !!paymentId,
  });
}

export function useInvoicePaymentProofs(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['payment-proofs', 'invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('payment_proofs')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PaymentProof[];
    },
    enabled: !!invoiceId,
  });
}

export function useUploadPaymentProof() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  return useMutation({
    mutationFn: async (input: {
      paymentId: string;
      invoiceId: string;
      businessId: string;
      file: File;
      userId: string;
    }) => {
      // Client-side file size validation
      if (input.file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large (${(input.file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`);
      }

      // Upload file to storage
      const fileExt = input.file.name.split('.').pop();
      const filePath = `${input.businessId}/${input.paymentId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, input.file);

      if (uploadError) {
        // Provide user-friendly storage error messages
        if (uploadError.message?.includes('Payload too large') || uploadError.message?.includes('file size')) {
          throw new Error('File too large. Maximum size is 5MB.');
        }
        if (uploadError.message?.includes('mime') || uploadError.message?.includes('type')) {
          throw new Error('Unsupported file type. Please upload an image or PDF.');
        }
        throw new Error('Failed to upload file. Please try again.');
      }

      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      // Create proof record
      const { data, error } = await supabase
        .from('payment_proofs')
        .insert({
          payment_id: input.paymentId,
          invoice_id: input.invoiceId,
          business_id: input.businessId,
          file_url: urlData.publicUrl,
          file_name: input.file.name,
          file_type: input.file.type || null,
          uploaded_by: input.userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
      toast({ title: 'Proof uploaded', description: 'Payment proof has been attached.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });
}
