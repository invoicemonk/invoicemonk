import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GeneratePdfParams {
  invoiceId: string;
  invoiceNumber: string;
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ invoiceId, invoiceNumber }: GeneratePdfParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://skcxogeaerudoadluexz.supabase.co/functions/v1/generate-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: invoiceId }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
        throw new Error(error.error || 'Failed to generate PDF');
      }

      const html = await response.text();
      const watermarkApplied = response.headers.get('X-Watermark-Applied') === 'true';
      const userTier = response.headers.get('X-User-Tier') || 'starter';

      return { html, invoiceNumber, watermarkApplied, userTier };
    },
    onSuccess: ({ html, invoiceNumber, watermarkApplied, userTier }) => {
      // Open HTML in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Auto-trigger print dialog after content loads
        printWindow.onload = () => {
          printWindow.print();
        };
        
        toast({
          title: 'PDF Ready',
          description: watermarkApplied 
            ? `Invoice ${invoiceNumber} opened for printing. Upgrade to remove watermark.`
            : `Invoice ${invoiceNumber} opened for printing.`,
        });
      } else {
        // Fallback: download as HTML file
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoiceNumber}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Invoice Downloaded',
          description: `Open ${invoiceNumber}.html and print to PDF.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error generating PDF',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
