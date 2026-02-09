import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { gaEvents } from '@/hooks/use-google-analytics';
import { sanitizeErrorMessage } from '@/lib/error-utils';

interface GeneratePdfParams {
  invoiceId: string;
  invoiceNumber: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

async function generatePdfWithRetry(invoiceId: string, attempt = 0): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: { 
      invoice_id: invoiceId,
      app_url: window.location.origin
    }
  });

  if (error) {
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      return generatePdfWithRetry(invoiceId, attempt + 1);
    }
    throw new Error(error.message || 'Failed to generate PDF');
  }

  return typeof data === 'string' ? data : '';
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ invoiceId, invoiceNumber }: GeneratePdfParams) => {
      const html = await generatePdfWithRetry(invoiceId);
      return { html, invoiceNumber };
    },
    onSuccess: ({ html, invoiceNumber }, variables) => {
      // Track PDF download event
      gaEvents.pdfDownloaded(variables.invoiceId);
      
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
          description: `Invoice ${invoiceNumber} opened for printing.`,
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
        title: 'PDF generation failed',
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}
