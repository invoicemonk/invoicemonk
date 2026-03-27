import { useState } from 'react';
import { INPUT_LIMITS } from '@/lib/input-limits';
import { Mail, Loader2, Send, AlertCircle, Plus, X, Info } from 'lucide-react';
import { stripUrls } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
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
const getProductionUrl = (): string => {
  const hostname = window.location.hostname;
  if (hostname.includes('lovableproject.com') || hostname.includes('lovable.app')) {
    return 'https://app.invoicemonk.com';
  }
  return window.location.origin;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendInvoiceDialog({ open, onOpenChange, invoice }: SendInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');

  // Primary client email: from recipient_snapshot or client record
  const recipientSnapshot = invoice.recipient_snapshot as { email?: string; name?: string } | null;
  const primaryEmail = recipientSnapshot?.email || invoice.clients?.email || '';
  const hasPrimaryEmail = !!primaryEmail;

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const addAdditionalEmail = () => {
    setAdditionalEmails(prev => [...prev, '']);
  };

  const removeAdditionalEmail = (index: number) => {
    setAdditionalEmails(prev => prev.filter((_, i) => i !== index));
  };

  const updateAdditionalEmail = (index: number, value: string) => {
    setAdditionalEmails(prev => prev.map((e, i) => i === index ? value : e));
  };

  const handleSend = async () => {
    if (!hasPrimaryEmail) {
      toast.error('Client does not have an email address. Please update the client record first.');
      return;
    }

    // Validate additional emails
    const validAdditional = additionalEmails
      .map(e => e.trim())
      .filter(e => e.length > 0);

    for (const email of validAdditional) {
      if (!emailRegex.test(email)) {
        toast.error(`Invalid additional email: ${email}`);
        return;
      }
    }

    // Dedupe: remove any additional emails that match the primary
    const dedupedAdditional = validAdditional.filter(
      e => e.toLowerCase() !== primaryEmail.toLowerCase()
    );

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
          recipient_email: primaryEmail,
          additional_recipients: dedupedAdditional.length > 0 ? dedupedAdditional : undefined,
          custom_message: customMessage ? stripUrls(customMessage) : undefined,
          app_url: getProductionUrl()
        }
      });

      if (response.error) {
        const serverMessage = typeof response.data === 'object' && response.data?.error
          ? response.data.error
          : response.error.message;
        throw new Error(serverMessage || 'Failed to send invoice');
      }
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      gaEvents.invoiceSent(invoice.id);
      
      const recipientCount = 1 + dedupedAdditional.length;
      toast.success(
        recipientCount > 1
          ? `Invoice sent to ${recipientCount} recipients!`
          : 'Invoice sent successfully!'
      );
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

          {/* Primary Client Email (read-only) */}
          <div className="space-y-2">
            <Label>Client Email (primary recipient) *</Label>
            {hasPrimaryEmail ? (
              <div className="flex items-center gap-2 bg-muted/30 border rounded-md px-3 py-2">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium">{primaryEmail}</span>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This client does not have an email address. Please update the client record before sending.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Additional Emails */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Additional Recipients (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addAdditionalEmail}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            {additionalEmails.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => updateAdditionalEmail(index, e.target.value)}
                  placeholder="additional@example.com"
                  maxLength={INPUT_LIMITS.EMAIL}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAdditionalEmail(index)}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
              maxLength={INPUT_LIMITS.TEXTAREA}
            />
          </div>

          {/* Info Alerts */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The email will include a PDF attachment of the invoice and a link to view it online.
            </AlertDescription>
          </Alert>

          <Alert variant="default" className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
              Payment reminders will only be sent to the client email ({primaryEmail || 'none'}). Additional recipients receive this invoice only.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !hasPrimaryEmail}>
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
