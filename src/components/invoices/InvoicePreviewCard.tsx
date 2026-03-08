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
  vat_registration_number?: string;
  is_vat_registered?: boolean;
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
  vat_registration_number?: string | null;
  is_vat_registered?: boolean | null;
  jurisdiction?: string;
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

export interface TemplateConfig {
  layout?: {
    header_style?: string;
    show_logo?: boolean;
    show_terms?: boolean;
    show_notes?: boolean;
    show_verification_qr?: boolean;
    show_issuer_details?: boolean;
    show_recipient_details?: boolean;
    show_line_items?: boolean;
    show_totals?: boolean;
    show_bank_details?: boolean;
  };
  styles?: {
    primary_color?: string;
    font_family?: string;
    font_size?: string;
  };
}

interface InvoicePreviewCardProps {
  invoice: Invoice;
  showWatermark?: boolean;
  business?: Business | null;
  templateConfig?: TemplateConfig | null;
}

// Default template config (matches "Professional/Standard" behavior)
const DEFAULT_LAYOUT = {
  header_style: 'standard',
  show_logo: true,
  show_terms: true,
  show_notes: true,
  show_verification_qr: true,
  show_issuer_details: true,
  show_recipient_details: true,
  show_line_items: true,
  show_totals: true,
  show_bank_details: false,
};

export function InvoicePreviewCard({ invoice, showWatermark = false, business, templateConfig }: InvoicePreviewCardProps) {
  const layout = { ...DEFAULT_LAYOUT, ...templateConfig?.layout };
  const primaryColor = templateConfig?.styles?.primary_color || undefined;

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
  
  const isNigerianInvoice = issuerSnapshot?.jurisdiction === 'NG' || business?.jurisdiction === 'NG';
  const isVatRegistered = issuerSnapshot?.is_vat_registered || business?.is_vat_registered;
  
  const displayIssuer = issuerSnapshot ? {
    ...issuerSnapshot,
    logo_url: issuerSnapshot.logo_url || business?.logo_url,
    vat_registration_number: issuerSnapshot.vat_registration_number || business?.vat_registration_number,
    is_vat_registered: issuerSnapshot.is_vat_registered ?? business?.is_vat_registered,
    jurisdiction: issuerSnapshot.jurisdiction || business?.jurisdiction,
  } : (business ? {
    legal_name: business.legal_name,
    name: business.name,
    tax_id: business.tax_id,
    vat_registration_number: business.vat_registration_number,
    is_vat_registered: business.is_vat_registered,
    jurisdiction: business.jurisdiction,
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

  const taxRates = invoice.invoice_items?.map(item => item.tax_rate) || [];
  const uniqueTaxRates = [...new Set(taxRates)];
  const uniformTaxRate = uniqueTaxRates.length === 1 ? uniqueTaxRates[0] : null;
  const isStandardNigerianVat = isNigerianInvoice && uniformTaxRate === 7.5;

  // Header style classes
  const headerStyle = layout.header_style;
  const getHeaderClasses = () => {
    switch (headerStyle) {
      case 'minimal':
        return 'pb-4';
      case 'modern':
        return 'pb-6 border-b-4';
      case 'enterprise':
        return 'pb-6 border-b-2 border-t-2';
      default: // standard
        return 'pb-6';
    }
  };

  const getHeaderBorderStyle = () => {
    if (!primaryColor) return {};
    if (headerStyle === 'modern') return { borderBottomColor: primaryColor };
    if (headerStyle === 'enterprise') return { borderBottomColor: primaryColor, borderTopColor: primaryColor };
    return {};
  };

  const getLabelStyle = () => {
    if (!primaryColor) return {};
    return { color: primaryColor };
  };

  const getTitleSize = () => {
    switch (headerStyle) {
      case 'minimal': return 'text-2xl';
      case 'modern': return 'text-4xl';
      case 'enterprise': return 'text-3xl';
      default: return 'text-3xl';
    }
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
        <CardHeader className={getHeaderClasses()} style={getHeaderBorderStyle()}>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              {/* Business Logo - conditionally shown */}
              {layout.show_logo && displayIssuer?.logo_url && (
                <img 
                  src={displayIssuer.logo_url} 
                  alt="Business Logo" 
                  className="h-16 w-auto max-w-[120px] object-contain"
                />
              )}
              <div>
                <h2 className={`${getTitleSize()} font-bold tracking-tight text-foreground`}>
                  INVOICE
                </h2>
                <p className={`${headerStyle === 'minimal' ? 'text-sm' : 'text-lg'} text-muted-foreground mt-1`}>
                  {invoice.invoice_number}
                </p>
                {invoice.summary && headerStyle !== 'minimal' && (
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
            {layout.show_issuer_details && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={getLabelStyle()}>
                  {headerStyle === 'enterprise' ? 'Issuer' : 'From'}
                </p>
                <div className="space-y-1">
                  <p className="font-semibold text-lg">
                    {displayIssuer?.legal_name || displayIssuer?.name || 'Your Business'}
                  </p>
                  {displayIssuer?.tax_id && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">TIN:</span>{' '}
                      <span className="font-mono">{displayIssuer.tax_id}</span>
                    </p>
                  )}
                  {displayIssuer?.is_vat_registered && displayIssuer?.vat_registration_number && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">VAT Reg:</span>{' '}
                      <span className="font-mono">{displayIssuer.vat_registration_number}</span>
                    </p>
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
            )}

            {/* To (Recipient) */}
            {layout.show_recipient_details && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={getLabelStyle()}>
                  {headerStyle === 'enterprise' ? 'Recipient' : 'Bill To'}
                </p>
                <div className="space-y-1">
                  <p className="font-semibold text-lg">
                    {recipientSnapshot?.name || invoice.clients?.name || 'Client'}
                  </p>
                  {(recipientSnapshot?.tax_id || invoice.clients?.tax_id) && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">TIN:</span>{' '}
                      <span className="font-mono">
                        {recipientSnapshot?.tax_id || invoice.clients?.tax_id}
                      </span>
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
            )}
          </div>

          <Separator style={primaryColor ? { backgroundColor: primaryColor, opacity: 0.2 } : {}} />

          {/* Line Items */}
          {layout.show_line_items && (
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-xs font-medium uppercase tracking-wider" style={getLabelStyle()}>Description</th>
                    <th className="text-right py-3 text-xs font-medium uppercase tracking-wider" style={getLabelStyle()}>Qty</th>
                    <th className="text-right py-3 text-xs font-medium uppercase tracking-wider" style={getLabelStyle()}>Unit Price</th>
                    {isNigerianInvoice && (
                      <th className="text-right py-3 text-xs font-medium uppercase tracking-wider" style={getLabelStyle()}>VAT</th>
                    )}
                    <th className="text-right py-3 text-xs font-medium uppercase tracking-wider" style={getLabelStyle()}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.invoice_items && invoice.invoice_items.length > 0 ? (
                    invoice.invoice_items.map((item) => (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="py-4 pr-4">
                          <p className="font-medium">{item.description}</p>
                          {!isNigerianInvoice && item.tax_rate > 0 && (
                            <p className="text-xs text-muted-foreground">Tax: {item.tax_rate}%</p>
                          )}
                        </td>
                        <td className="py-4 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-4 text-right tabular-nums">
                          {formatCurrency(Number(item.unit_price), invoice.currency)}
                        </td>
                        {isNigerianInvoice && (
                          <td className="py-4 text-right tabular-nums text-muted-foreground">
                            {item.tax_rate === 7.5 ? '7.5%' : item.tax_rate === 0 ? 'Exempt' : `${item.tax_rate}%`}
                          </td>
                        )}
                        <td className="py-4 text-right tabular-nums font-medium">
                          {formatCurrency(Number(item.amount), invoice.currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isNigerianInvoice ? 5 : 4} className="py-8 text-center text-muted-foreground">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          {layout.show_totals && (
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isNigerianInvoice ? 'Subtotal (excl. VAT)' : 'Subtotal'}
                  </span>
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
                  <span className="text-muted-foreground">
                    {isStandardNigerianVat ? 'VAT @ 7.5%' : isNigerianInvoice ? 'VAT' : 'Tax'}
                  </span>
                  <span className="tabular-nums">{formatCurrency(Number(invoice.tax_amount), invoice.currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{isNigerianInvoice ? 'Total (incl. VAT)' : 'Total'}</span>
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
          )}

          {/* Notes & Terms */}
          {(layout.show_notes || layout.show_terms) && (invoice.notes || invoice.terms) && (
            <>
              <Separator />
              <div className="grid md:grid-cols-2 gap-6">
                {layout.show_notes && invoice.notes && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={getLabelStyle()}>Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {layout.show_terms && invoice.terms && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={getLabelStyle()}>Terms & Conditions</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Verification Section with QR Code */}
          {layout.show_verification_qr && invoice.verification_id && (
            <div className="pt-4 border-t border-dashed flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={getLabelStyle()}>Verification</p>
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
