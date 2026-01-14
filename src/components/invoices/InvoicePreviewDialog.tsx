import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { InvoicePreviewCard } from './InvoicePreviewCard';
import { Eye } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & {
  clients?: Tables<'clients'> | null;
  invoice_items?: Tables<'invoice_items'>[];
};

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  showWatermark?: boolean;
}

export function InvoicePreviewDialog({ 
  open, 
  onOpenChange, 
  invoice,
  showWatermark = false 
}: InvoicePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Invoice Preview
            {invoice.status === 'draft' && (
              <Badge variant="secondary" className="ml-2">
                Draft Preview
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <InvoicePreviewCard invoice={invoice} showWatermark={showWatermark} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
