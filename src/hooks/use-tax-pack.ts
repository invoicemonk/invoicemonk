import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TaxPackRequest {
  business_id: string;
  currency_account_id: string;
  period_start: string;
  period_end: string;
}

export function useTaxPack() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTaxPack = async (request: TaxPackRequest) => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'skcxogeaerudoadluexz';
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-tax-pack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.upgrade_required) {
          toast.error('Upgrade required', { description: errorData.error });
          return;
        }
        throw new Error(errorData.error || 'Failed to generate tax pack');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-pack-${request.period_start}-to-${request.period_end}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Tax Pack generated', { description: 'Your tax filing summary has been downloaded.' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate tax pack');
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateTaxPack, isGenerating };
}
