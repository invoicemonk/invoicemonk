import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { gaEvents } from '@/hooks/use-google-analytics';

interface GeneratePdfParams {
  invoiceId: string;
  invoiceNumber: string;
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ invoiceId, invoiceNumber }: GeneratePdfParams) => {
      // Use supabase.functions.invoke for consistent auth handling
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: { 
          invoice_id: invoiceId,
          app_url: window.location.origin // Pass current domain for correct QR/verification links
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate PDF');
      }

      // The response is HTML text
      const html = typeof data === 'string' ? data : '';
      
      // Note: When using supabase.functions.invoke, we can't easily access response headers
      // The watermark/tier info would need to be embedded in the response if needed
      const watermarkApplied = false; // Will be determined by the HTML content itself
      const userTier = 'unknown';

      return { html, invoiceNumber, watermarkApplied, userTier };
    },
    onSuccess: ({ html, invoiceNumber, watermarkApplied, userTier }, variables) => {
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
