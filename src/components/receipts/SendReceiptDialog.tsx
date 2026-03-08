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
import type { Receipt } from '@/hooks/use-receipts';

interface SendReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: Receipt;
}

const getProductionUrl = (): string => {
  const hostname = window.location.hostname;
  if (hostname.includes('lovableproject.com') || hostname.includes('lovable.app')) {
    return 'https://app.invoicemonk.com';
  }
  return window.location.origin;
};

export function SendReceiptDialog({ open, onOpenChange, receipt }: SendReceiptDialogProps) {
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(
    receipt.payer_snapshot?.email || ''
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to send receipts');
        return;
      }

      const response = await supabase.functions.invoke('send-receipt-email', {
        body: {
          receipt_id: receipt.id,
          recipient_email: recipientEmail,
          custom_message: customMessage || undefined,
          app_url: getProductionUrl(),
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send receipt');
      }

      toast.success('Receipt sent successfully!');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Send receipt error:', error);
      toast.error(error.message || 'Failed to send receipt');
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
            Send Receipt
          </DialogTitle>
          <DialogDescription>
            Send receipt {receipt.receipt_number} to your client via email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Receipt Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Receipt</span>
              <span className="font-medium">{receipt.receipt_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payer</span>
              <span>{receipt.payer_snapshot?.name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(Number(receipt.amount), receipt.currency)}</span>
            </div>
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="receipt-email">Recipient Email *</Label>
            <Input
              id="receipt-email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="receipt-message">Custom Message (optional)</Label>
            <Textarea
              id="receipt-message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal message to include in the email..."
              rows={3}
            />
          </div>

          {/* Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The email will include a PDF attachment of the receipt and a link to verify it online.
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
                Send Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
