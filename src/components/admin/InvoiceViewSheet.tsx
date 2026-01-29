import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileText, Building2, User, Calendar, Shield, Lock, ExternalLink, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceData {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  amount_paid: number;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  issued_at: string | null;
  created_at: string;
  invoice_hash: string | null;
  verification_id: string | null;
  notes: string | null;
  terms: string | null;
  void_reason: string | null;
  voided_at: string | null;
  client?: { name: string; email: string | null };
  business?: { name: string };
}

interface InvoiceViewSheetProps {
  invoice: InvoiceData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceViewSheet({ invoice, open, onOpenChange }: InvoiceViewSheetProps) {
  if (!invoice) return null;

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'default', label: 'Issued' },
      sent: { variant: 'default', label: 'Sent' },
      viewed: { variant: 'outline', label: 'Viewed' },
      paid: { variant: 'default', label: 'Paid' },
      voided: { variant: 'destructive', label: 'Voided' },
      credited: { variant: 'outline', label: 'Credited' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const verificationUrl = invoice.verification_id 
    ? `${window.location.origin}/verify/${invoice.verification_id}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Invoice Details</SheetTitle>
          <SheetDescription>
            Read-only view of invoice information
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Invoice Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-semibold text-lg">{invoice.invoice_number}</h3>
                  {invoice.status !== 'draft' && (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {getStatusBadge(invoice.status)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Parties */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Parties</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Business</p>
                  <p className="font-medium">{invoice.business?.name || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{invoice.client?.name || 'Unknown'}</p>
                  {invoice.client?.email && (
                    <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Amounts */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Amounts</h4>
            
            <div className="space-y-2 bg-muted rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(invoice.total_amount, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-green-600">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Balance Due</span>
                <span className={invoice.total_amount - invoice.amount_paid > 0 ? 'text-destructive' : ''}>
                  {formatCurrency(invoice.total_amount - invoice.amount_paid, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Dates</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">
                  {invoice.issue_date 
                    ? format(new Date(invoice.issue_date), 'MMM d, yyyy')
                    : 'Not issued'
                  }
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">
                  {invoice.due_date 
                    ? format(new Date(invoice.due_date), 'MMM d, yyyy')
                    : 'Not set'
                  }
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(invoice.created_at), 'MMM d, yyyy HH:mm')}
                </p>
              </div>

              {invoice.issued_at && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Issued At</p>
                  <p className="font-medium">
                    {format(new Date(invoice.issued_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Voided Info */}
          {invoice.voided_at && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-destructive uppercase tracking-wider">Voided</h4>
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Voided on: </span>
                    {format(new Date(invoice.voided_at), 'MMM d, yyyy HH:mm')}
                  </p>
                  {invoice.void_reason && (
                    <p className="text-sm mt-1">
                      <span className="text-muted-foreground">Reason: </span>
                      {invoice.void_reason}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Integrity */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Integrity</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Hash Verification</span>
                {invoice.invoice_hash ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>

              {invoice.invoice_hash && (
                <div className="bg-muted rounded-md p-3">
                  <p className="text-xs text-muted-foreground mb-1">SHA-256 Hash</p>
                  <p className="font-mono text-xs break-all">{invoice.invoice_hash}</p>
                </div>
              )}

              {verificationUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Public Verification Link</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.open(verificationUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Verification Page
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* System Info */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">System Info</h4>
            <div className="bg-muted rounded-md p-3 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Invoice ID</p>
                <p className="font-mono text-xs break-all">{invoice.id}</p>
              </div>
              {invoice.verification_id && (
                <div>
                  <p className="text-xs text-muted-foreground">Verification ID</p>
                  <p className="font-mono text-xs break-all">{invoice.verification_id}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
