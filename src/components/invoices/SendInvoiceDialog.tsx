import { useState } from 'react';
import { Mail, Loader2, Send, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { gaEvents } from '@/hooks/use-google-analytics';

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Tables<'invoices'> & {
    clients?: Tables<'clients'> | null;
    invoice_items?: Tables<'invoice_items'>[] | null;
  };
}

// Determine the correct app URL for email links
// Never use Lovable preview/project URLs in emails - use production URL
const getProductionUrl = (): string => {
  const hostname = window.location.hostname;
  
  // If on Lovable preview domains, use production URL
  if (hostname.includes('lovableproject.com') || 
      hostname.includes('lovable.app')) {
    return 'https://app.invoicemonk.com';
  }
  
  // Otherwise use current origin (for custom domains)
  return window.location.origin;
};

export function SendInvoiceDialog({ open, onOpenChange, invoice }: SendInvoiceDialogProps) {
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(
    invoice.clients?.email || ''
  );
  const [customMessage, setCustomMessage] = useState('');

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      toast.error('Please enter a recipient email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to send invoices');
        return;
      }

      const response = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoice_id: invoice.id,
          recipient_email: recipientEmail,
          custom_message: customMessage || undefined,
          app_url: getProductionUrl() // Use production URL for verification links
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send invoice');
      }

      // Track invoice sent event
      gaEvents.invoiceSent(invoice.id);
      toast.success('Invoice sent successfully!');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Send invoice error:', error);
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Invoice
          </DialogTitle>
          <DialogDescription>
            Send invoice {invoice.invoice_number} to your client via email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Invoice Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Client</span>
              <span>{invoice.clients?.name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(Number(invoice.total_amount), invoice.currency)}</span>
            </div>
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email *</Label>
            <Input
              id="email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (optional)</Label>
            <Textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal message to include in the email..."
              rows={3}
            />
          </div>

          {/* Email Preview Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The email will include a PDF attachment of the invoice and a link to view it online.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !recipientEmail.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
