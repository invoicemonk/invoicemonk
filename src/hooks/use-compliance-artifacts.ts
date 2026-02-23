import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ComplianceArtifact {
  id: string;
  invoice_id: string;
  business_id: string;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  artifact_hash: string;
  generated_at: string;
  created_by: string | null;
  xml_content: string | null;
  xml_hash: string | null;
  xml_generated_at: string | null;
  schema_version: string | null;
}

interface ComplianceAnalytics {
  id: string;
  business_id: string;
  period: string;
  avg_score: number;
  total_invoices: number;
  blocked_count: number;
  warning_count: number;
  artifact_count: number;
  last_updated: string;
}

export function useComplianceArtifacts(invoiceId?: string) {
  return useQuery({
    queryKey: ['compliance-artifacts', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('compliance_artifacts')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('generated_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ComplianceArtifact[];
    },
    enabled: !!invoiceId,
  });
}

export function useGenerateArtifacts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-artifacts', {
        body: { invoice_id: invoiceId },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['compliance-artifacts', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['compliance-analytics'] });
      const count = data?.artifacts?.length || 0;
      if (count > 0) {
        toast.success(`Generated ${count} compliance artifact${count !== 1 ? 's' : ''}`);
      } else {
        toast.info('All artifacts already generated');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate artifacts: ${error.message}`);
    },
  });
}

export function useGenerateXmlArtifact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (artifactId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-xml-artifact', {
        body: { artifact_id: artifactId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compliance-artifacts'] });
      if (data?.xml_hash) {
        toast.success(`XML generated (${data.schema_version})`);
      }
    },
    onError: (error: Error) => {
      toast.error(`XML generation failed: ${error.message}`);
    },
  });
}

export function useComplianceAnalytics(businessId?: string) {
  return useQuery({
    queryKey: ['compliance-analytics', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await supabase
        .from('business_compliance_analytics')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ComplianceAnalytics | null;
    },
    enabled: !!businessId,
  });
}
