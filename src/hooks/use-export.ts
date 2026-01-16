import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportParams {
  export_type: 'invoices' | 'audit_logs' | 'payments' | 'clients';
  business_id?: string;
  date_from?: string;
  date_to?: string;
  format?: 'csv' | 'json';
}

interface ExportResponse {
  success: boolean;
  export_id?: string;
  manifest_id?: string;
  data?: string;
  filename?: string;
  record_count?: number;
  generated_at?: string;
  integrity_hash?: string;
  error?: string;
  upgrade_required?: boolean;
  tier?: string;
}

export function useExportRecords() {
  const [isExporting, setIsExporting] = useState(false);

  const exportRecords = async (params: ExportParams): Promise<boolean> => {
    setIsExporting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke<ExportResponse>('export-records', {
        body: params
      });

      if (error) {
        console.error('Export error:', error);
        toast.error('Export failed', {
          description: error.message || 'An unexpected error occurred'
        });
        return false;
      }

      if (!data?.success) {
        if (data?.upgrade_required) {
          toast.error('Upgrade Required', {
            description: data.error || 'Data exports require a Professional subscription.'
          });
        } else {
          toast.error('Export failed', {
            description: data?.error || 'Unknown error'
          });
        }
        return false;
      }

      // Download the file
      if (data.data && data.filename) {
        const blob = new Blob([data.data], { 
          type: params.format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Export Complete', {
          description: `${data.record_count} records exported successfully`
        });
        return true;
      }

      return false;
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed', {
        description: 'An unexpected error occurred'
      });
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportRecords, isExporting };
}
