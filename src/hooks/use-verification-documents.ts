import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface VerificationDocument {
  id: string;
  business_id: string;
  uploaded_by: string;
  document_type: string;
  file_url: string;
  file_name: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export function useVerificationDocuments(businessId: string | undefined) {
  return useQuery({
    queryKey: ['verification-documents', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('verification_documents')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VerificationDocument[];
    },
    enabled: !!businessId,
  });
}

export function useUploadVerificationDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      businessId,
      file,
      documentType,
    }: {
      businessId: string;
      file: File;
      documentType: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Validate file
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 10MB.');
      }

      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a PDF or image file.');
      }

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${businessId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get signed URL (private bucket)
      const { data: urlData } = await supabase.storage
        .from('verification-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      const fileUrl = urlData?.signedUrl || filePath;

      // Insert document record
      const { data, error } = await supabase
        .from('verification_documents')
        .insert({
          business_id: businessId,
          uploaded_by: user.id,
          document_type: documentType,
          file_url: fileUrl,
          file_path: filePath,
          file_name: file.name,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['verification-documents', variables.businessId] });
      toast({
        title: 'Document uploaded',
        description: 'Your verification document has been uploaded successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSubmitForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId: string) => {
      const { error } = await supabase
        .from('businesses')
        .update({
          verification_status: 'pending_review',
          verification_source: 'manual_review',
          document_verification_status: 'pending_review',
          verification_submitted_at: new Date().toISOString(),
        } as any)
        .eq('id', businessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      toast({
        title: 'Submitted for review',
        description: 'Your business will be reviewed by our team. You\'ll be notified of the result.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Submission failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
