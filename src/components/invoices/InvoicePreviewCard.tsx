import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & {
  clients?: Tables<'clients'> | null;
  invoice_items?: Tables<'invoice_items'>[];
};

interface IssuerSnapshot {
  legal_name?: string;
  name?: string;
  tax_id?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  jurisdiction?: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
}

interface RecipientSnapshot {
  name?: string;
  email?: string;
  tax_id?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  phone?: string;
}

interface Business {
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  logo_url?: string | null;
}

interface InvoicePreviewCardProps {
  invoice: Invoice;
  showWatermark?: boolean;
  business?: Business | null;
}

export function InvoicePreviewCard({ invoice, showWatermark = false, business }: InvoicePreviewCardProps) {
  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null;
  const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null;
  const isImmutable = invoice.status !== 'draft';
  
  // For drafts, use live business data if no snapshot exists
  const displayIssuer = issuerSnapshot || (business ? {
    legal_name: business.legal_name,
    name: business.name,
    tax_id: business.tax_id,
    address: business.address,
    contact_email: business.contact_email,
    contact_phone: business.contact_phone,
    logo_url: business.logo_url,
  } : null);

  const formatAddress = (address?: { street?: string; city?: string; state?: string; postal_code?: string; country?: string }) => {
    if (!address) return null;
    const parts = [address.street, address.city, address.state, address.postal_code, address.country].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <Card className="relative overflow-hidden bg-white dark:bg-card print:shadow-none">
      {/* Watermark */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
          <span className="text-8xl font-bold text-foreground rotate-[-30deg]">INVOICEMONK</span>
        </div>
      )}

      <div className="relative z-10">
        {/* Invoice Header */}
        <CardHeader className="pb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              {/* Business Logo */}
              {displayIssuer?.logo_url && (
                <img 
                  src={displayIssuer.logo_url} 
                  alt="Business Logo" 
                  className="h-16 w-auto max-w-[120px] object-contain"
                />
              )}
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">INVOICE</h2>
                <p className="text-lg text-muted-foreground mt-1">{invoice.invoice_number}</p>
                {invoice.summary && (
                  <p className="text-sm text-muted-foreground italic mt-2 max-w-md">
                    {invoice.summary}
                  </p>
                )}
                {isImmutable && (
                  <Badge variant="outline" className="mt-2 gap-1">
                    <Lock className="h-3 w-3" />
                    Immutable Record
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Issue Date</p>
              <p className="font-medium">{formatDate(invoice.issue_date)}</p>
              {invoice.due_date && (
                <>
                  <p className="text-sm text-muted-foreground mt-2">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.due_date)}</p>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* From / To Section */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* From (Issuer) */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">From</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">
                  {displayIssuer?.legal_name || displayIssuer?.name || 'Your Business'}
                </p>
                {displayIssuer?.tax_id && (
                  <p className="text-sm text-muted-foreground font-mono">{displayIssuer.tax_id}</p>
                )}
                {displayIssuer?.address && (
                  <p className="text-sm text-muted-foreground">{formatAddress(displayIssuer.address)}</p>
                )}
                {displayIssuer?.contact_email && (
                  <p className="text-sm text-muted-foreground">{displayIssuer.contact_email}</p>
                )}
                {displayIssuer?.contact_phone && (
                  <p className="text-sm text-muted-foreground">{displayIssuer.contact_phone}</p>
                )}
              </div>
            </div>

            {/* To (Recipient) */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Bill To</p>
              <div className="space-y-1">
                <p className="font-semibold text-lg">
                  {recipientSnapshot?.name || invoice.clients?.name || 'Client'}
                </p>
                {(recipientSnapshot?.tax_id || invoice.clients?.tax_id) && (
                  <p className="text-sm text-muted-foreground font-mono">
                    {recipientSnapshot?.tax_id || invoice.clients?.tax_id}
                  </p>
                )}
                {recipientSnapshot?.address && (
                  <p className="text-sm text-muted-foreground">{formatAddress(recipientSnapshot.address)}</p>
                )}
                {(recipientSnapshot?.email || invoice.clients?.email) && (
                  <p className="text-sm text-muted-foreground">
                    {recipientSnapshot?.email || invoice.clients?.email}
                  </p>
                )}
                {(recipientSnapshot?.phone || invoice.clients?.phone) && (
                  <p className="text-sm text-muted-foreground">
                    {recipientSnapshot?.phone || invoice.clients?.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit Price</th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_items && invoice.invoice_items.length > 0 ? (
                  invoice.invoice_items.map((item) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-4 pr-4">
                        <p className="font-medium">{item.description}</p>
                        {item.tax_rate > 0 && (
                          <p className="text-xs text-muted-foreground">Tax: {item.tax_rate}%</p>
                        )}
                      </td>
                      <td className="py-4 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-4 text-right tabular-nums">
                        {formatCurrency(Number(item.unit_price), invoice.currency)}
                      </td>
                      <td className="py-4 text-right tabular-nums font-medium">
                        {formatCurrency(Number(item.amount), invoice.currency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No line items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive">
                    -{formatCurrency(Number(invoice.discount_amount), invoice.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{formatCurrency(Number(invoice.tax_amount), invoice.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(Number(invoice.total_amount), invoice.currency)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Paid</span>
                    <span className="tabular-nums">-{formatCurrency(Number(invoice.amount_paid), invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Balance Due</span>
                    <span className="tabular-nums">
                      {formatCurrency(Number(invoice.total_amount) - Number(invoice.amount_paid), invoice.currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <>
              <Separator />
              <div className="grid md:grid-cols-2 gap-6">
                {invoice.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Terms & Conditions</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Verification Section with QR Code */}
          {invoice.verification_id && (
            <div className="pt-4 border-t border-dashed flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Verification</p>
                <p className="text-xs text-muted-foreground">
                  ID: <span className="font-mono">{invoice.verification_id}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scan QR code or visit the verification portal to verify this invoice
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <QRCodeSVG 
                  value={`${window.location.origin}/verify/invoice/${invoice.verification_id}`}
                  size={80}
                  level="M"
                  className="border border-border rounded p-1"
                />
                <span className="text-[10px] text-muted-foreground">Scan to verify</span>
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
