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

export function InvoicePreviewCard({ invoice, showWatermark = false, business, templateConfig: templateConfigProp }: InvoicePreviewCardProps) {
  // Auto-derive templateConfig from invoice.template_snapshot when no explicit prop is passed
  const templateConfig = templateConfigProp ?? (invoice.template_snapshot ? {
    layout: (invoice.template_snapshot as Record<string, unknown>).layout as TemplateConfig['layout'],
    styles: (invoice.template_snapshot as Record<string, unknown>).styles as TemplateConfig['styles'],
  } : null);
  const layout = { ...DEFAULT_LAYOUT, ...templateConfig?.layout };
  const primaryColor = templateConfig?.styles?.primary_color || '#1d6b5a';
  const headerStyle = layout.header_style || 'standard';

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
  const isReverseCharge = (invoice as any).is_reverse_charge === true;

  // Group taxes by label for multi-country VAT breakdown
  const taxGroups: { label: string; rate: number; amount: number }[] = [];
  if (invoice.invoice_items) {
    const groupMap: Record<string, { label: string; rate: number; amount: number }> = {};
    invoice.invoice_items.forEach(item => {
      if (item.tax_rate > 0) {
        const label = (item as any).tax_label || `Tax`;
        const key = `${label}@${item.tax_rate}`;
        if (!groupMap[key]) {
          groupMap[key] = { label, rate: item.tax_rate, amount: 0 };
        }
        groupMap[key].amount += Number(item.tax_amount);
      }
    });
    taxGroups.push(...Object.values(groupMap));
  }
  const hasMultipleTaxGroups = taxGroups.length > 1;

  const issuerName = displayIssuer?.legal_name || displayIssuer?.name || 'Your Business';
  const recipientName = recipientSnapshot?.name || invoice.clients?.name || 'Client';

  // Shared components
  const renderLineItems = (tableClassName?: string, headerBg?: string) => (
    <table className={`w-full ${tableClassName || ''}`}>
      <thead>
        <tr className="border-b border-border" style={headerBg ? { backgroundColor: headerBg } : {}}>
          <th className="text-left py-3 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</th>
          <th className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Qty</th>
          <th className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Unit Price</th>
          {isNigerianInvoice && (
            <th className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">VAT</th>
          )}
          <th className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.invoice_items && invoice.invoice_items.length > 0 ? (
          invoice.invoice_items.map((item) => (
            <tr key={item.id} className="border-b border-border/50">
              <td className="py-3 px-2">
                <p className="font-medium text-sm">{item.description}</p>
                {!isNigerianInvoice && item.tax_rate > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(item as any).tax_label ? `${(item as any).tax_label}: ${item.tax_rate}%` : `Tax: ${item.tax_rate}%`}
                  </p>
                )}
              </td>
              <td className="py-3 px-2 text-right tabular-nums text-sm">{item.quantity}</td>
              <td className="py-3 px-2 text-right tabular-nums text-sm">
                {formatCurrency(Number(item.unit_price), invoice.currency)}
              </td>
              {isNigerianInvoice && (
                <td className="py-3 px-2 text-right tabular-nums text-sm text-muted-foreground">
                  {item.tax_rate === 7.5 ? '7.5%' : item.tax_rate === 0 ? 'Exempt' : `${item.tax_rate}%`}
                </td>
              )}
              <td className="py-3 px-2 text-right tabular-nums text-sm font-medium">
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
  );

  const renderTotals = () => (
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
      {isReverseCharge && (
        <Badge variant="outline" className="w-full justify-center text-amber-600 border-amber-300 text-xs">
          Reverse Charge — recipient liable for VAT
        </Badge>
      )}
      {hasMultipleTaxGroups ? (
        taxGroups.map((g, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{g.label} @ {g.rate}%</span>
            <span className="tabular-nums">{formatCurrency(g.amount, invoice.currency)}</span>
          </div>
        ))
      ) : (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {isStandardNigerianVat ? 'VAT @ 7.5%' : isNigerianInvoice ? 'VAT' : taxGroups.length === 1 ? `${taxGroups[0].label} @ ${taxGroups[0].rate}%` : 'Tax'}
          </span>
          <span className="tabular-nums">{formatCurrency(Number(invoice.tax_amount), invoice.currency)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between text-lg font-bold">
        <span>{isNigerianInvoice ? 'Total (incl. VAT)' : 'Total'}</span>
        <span className="tabular-nums">{formatCurrency(Number(invoice.total_amount), invoice.currency)}</span>
      </div>
      {Number(invoice.amount_paid) > 0 && (
        <>
          <div className="flex justify-between text-sm" style={{ color: '#059669' }}>
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
  );

  const renderQR = () => {
    if (!layout.show_verification_qr) return null;
    if (!invoice.verification_id) {
      // Draft placeholder
      return (
        <div className="flex flex-col items-center gap-1 opacity-40">
          <div className="h-[80px] w-[80px] border-2 border-dashed border-muted-foreground/50 rounded flex items-center justify-center">
            <span className="text-[9px] text-muted-foreground text-center leading-tight px-1">QR generated<br/>on issue</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Verification QR</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-1">
        <QRCodeSVG 
          value={`${window.location.origin}/verify/invoice/${invoice.verification_id}`}
          size={80}
          level="M"
          className="border border-border rounded p-1"
        />
        <span className="text-[10px] text-muted-foreground">Scan to verify</span>
      </div>
    );
  };

  const renderPaymentMethod = (accentColor?: string) => {
    const pm = invoice.payment_method_snapshot as { provider_type?: string; display_name?: string; instructions?: Record<string, string> } | null;
    if (!pm?.instructions) return null;
    const entries = Object.entries(pm.instructions).filter(([, v]) => v);
    if (entries.length === 0) return null;
    const color = accentColor || primaryColor;
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color }}>Payment Instructions</p>
        <p className="text-sm font-medium mb-2">{pm.display_name || pm.provider_type}</p>
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground capitalize shrink-0">{k.replace(/_/g, ' ')}</span>
              <span className="font-mono text-right truncate">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          Reference: <span className="font-mono font-medium text-foreground">{invoice.invoice_number}</span>
        </div>
      </div>
    );
  };

  const renderIssuerDetails = () => {
    if (!layout.show_issuer_details || !displayIssuer) return null;
    return (
      <div className="space-y-1">
        <p className="font-semibold text-lg">{issuerName}</p>
        {displayIssuer.tax_id && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">TIN:</span> <span className="font-mono">{displayIssuer.tax_id}</span>
          </p>
        )}
        {displayIssuer.is_vat_registered && displayIssuer.vat_registration_number && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">VAT Reg:</span> <span className="font-mono">{displayIssuer.vat_registration_number}</span>
          </p>
        )}
        {displayIssuer.address && (
          <p className="text-sm text-muted-foreground">{formatAddress(displayIssuer.address)}</p>
        )}
        {displayIssuer.contact_email && (
          <p className="text-sm text-muted-foreground">{displayIssuer.contact_email}</p>
        )}
        {displayIssuer.contact_phone && (
          <p className="text-sm text-muted-foreground">{displayIssuer.contact_phone}</p>
        )}
      </div>
    );
  };

  const renderRecipientDetails = () => {
    if (!layout.show_recipient_details) return null;
    return (
      <div className="space-y-1">
        <p className="font-semibold text-lg">{recipientName}</p>
        {(recipientSnapshot?.tax_id || invoice.clients?.tax_id) && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">TIN:</span> <span className="font-mono">{recipientSnapshot?.tax_id || invoice.clients?.tax_id}</span>
          </p>
        )}
        {(recipientSnapshot?.address || invoice.clients?.address) && (
          <p className="text-sm text-muted-foreground">
            {formatAddress((recipientSnapshot?.address || invoice.clients?.address) as Record<string, string>)}
          </p>
        )}
        {(recipientSnapshot?.email || invoice.clients?.email) && (
          <p className="text-sm text-muted-foreground">{recipientSnapshot?.email || invoice.clients?.email}</p>
        )}
        {(recipientSnapshot?.phone || invoice.clients?.phone) && (
          <p className="text-sm text-muted-foreground">{recipientSnapshot?.phone || invoice.clients?.phone}</p>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // MINIMAL (Basic) Layout
  // ─────────────────────────────────────────────
  if (headerStyle === 'minimal') {
    return (
      <Card className="relative overflow-hidden bg-white dark:bg-card print:shadow-none">
        {showWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
            <span className="text-8xl font-bold text-foreground rotate-[-30deg]">INVOICEMONK</span>
          </div>
        )}
        <div className="relative z-10 p-8">
          {/* Compact header: invoice number + dates on one line */}
          <div className="flex justify-between items-baseline pb-4 border-b" style={{ borderColor: '#e5e7eb' }}>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">INVOICE</h2>
              <p className="text-sm text-muted-foreground">{invoice.invoice_number}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Issued: {formatDate(invoice.issue_date)}</p>
              {invoice.due_date && <p>Due: {formatDate(invoice.due_date)}</p>}
            </div>
          </div>

          {/* From / To - compact */}
          <div className="grid grid-cols-2 gap-6 py-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">From</p>
              <p className="font-medium">{issuerName}</p>
              {displayIssuer?.contact_email && <p className="text-sm text-muted-foreground">{displayIssuer.contact_email}</p>}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">To</p>
              <p className="font-medium">{recipientName}</p>
              {(recipientSnapshot?.email || invoice.clients?.email) && (
                <p className="text-sm text-muted-foreground">{recipientSnapshot?.email || invoice.clients?.email}</p>
              )}
            </div>
          </div>

          {/* Items - clean compact table */}
          {layout.show_line_items && renderLineItems()}

          {/* Totals - right aligned, minimal */}
          {layout.show_totals && (
            <div className="flex justify-end pt-4">
              {renderTotals()}
            </div>
          )}

          {/* Payment Instructions */}
          {renderPaymentMethod()}

          {/* Notes & Terms */}
          {(layout.show_notes || layout.show_terms) && (invoice.notes || invoice.terms) && (
            <div className="grid md:grid-cols-2 gap-4 pt-4">
              {layout.show_notes && invoice.notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {layout.show_terms && invoice.terms && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Terms</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* QR + Verification */}
          {layout.show_verification_qr && (
            <div className="flex items-center justify-between pt-4 border-t border-dashed">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Verification</p>
                {invoice.verification_id && (
                  <p className="text-xs text-muted-foreground">ID: <span className="font-mono">{invoice.verification_id}</span></p>
                )}
              </div>
              {renderQR()}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ─────────────────────────────────────────────
  // MODERN Layout
  // ─────────────────────────────────────────────
  if (headerStyle === 'modern') {
    return (
      <Card className="relative overflow-hidden bg-white dark:bg-card print:shadow-none">
        {showWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
            <span className="text-8xl font-bold text-foreground rotate-[-30deg]">INVOICEMONK</span>
          </div>
        )}
        <div className="relative z-10">
          {/* Full-width brand color header bar */}
          <div className="px-8 py-6" style={{ backgroundColor: primaryColor }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                {layout.show_logo && displayIssuer?.logo_url && (
                  <img 
                    src={displayIssuer.logo_url} 
                    alt="Logo" 
                    className="h-14 w-auto max-w-[100px] object-contain rounded bg-white/90 p-1.5"
                  />
                )}
                <div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#ffffff' }}>INVOICE</h2>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{invoice.invoice_number}</p>
                </div>
              </div>
              <div className="text-right" style={{ color: 'rgba(255,255,255,0.9)' }}>
                <p className="text-sm">Issue: {formatDate(invoice.issue_date)}</p>
                {invoice.due_date && <p className="text-sm">Due: {formatDate(invoice.due_date)}</p>}
              </div>
            </div>
            {isImmutable && (
              <Badge variant="outline" className="mt-3 gap-1 border-white/30 text-white/90">
                <Lock className="h-3 w-3" />
                Immutable Record
              </Badge>
            )}
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Summary / Description */}
            {invoice.summary && (
              <p className="text-sm text-muted-foreground italic max-w-md">{invoice.summary}</p>
            )}

            {/* From / To in cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {layout.show_issuer_details && (
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>From</p>
                  {renderIssuerDetails()}
                </div>
              )}
              {layout.show_recipient_details && (
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Bill To</p>
                  {renderRecipientDetails()}
                </div>
              )}
            </div>

            {/* Items with brand-colored header */}
            {layout.show_line_items && (
              <div className="rounded-lg border border-border overflow-hidden">
                {renderLineItems('', `${primaryColor}10`)}
              </div>
            )}

            {/* Totals in a card */}
            {layout.show_totals && (
              <div className="flex justify-end">
                <div className="rounded-lg border border-border p-4 bg-muted/20">
                  {renderTotals()}
                </div>
              </div>
            )}

            {/* Payment Instructions */}
            {renderPaymentMethod(primaryColor)}

            {/* Notes & Terms in cards */}
            {(layout.show_notes || layout.show_terms) && (invoice.notes || invoice.terms) && (
              <div className="grid md:grid-cols-2 gap-4">
                {layout.show_notes && invoice.notes && (
                  <div className="rounded-lg border border-border p-4 bg-muted/20">
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {layout.show_terms && invoice.terms && (
                  <div className="rounded-lg border border-border p-4 bg-muted/20">
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Terms</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
              </div>
            )}

            {/* QR + Verification */}
            {layout.show_verification_qr && (
              <div className="flex items-center justify-between pt-4 border-t border-dashed">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: primaryColor }}>Verification</p>
                  {invoice.verification_id && (
                    <p className="text-xs text-muted-foreground">ID: <span className="font-mono">{invoice.verification_id}</span></p>
                  )}
                </div>
                {renderQR()}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // ─────────────────────────────────────────────
  // ENTERPRISE Layout
  // ─────────────────────────────────────────────
  if (headerStyle === 'enterprise') {
    return (
      <Card className="relative overflow-hidden bg-white dark:bg-card print:shadow-none">
        {showWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
            <span className="text-8xl font-bold text-foreground rotate-[-30deg]">INVOICEMONK</span>
          </div>
        )}
        <div className="relative z-10 p-8 space-y-6">
          {/* Formal letterhead: double border, centered logo + business name */}
          <div className="text-center pb-6 border-t-2 border-b-2 pt-6" style={{ borderColor: primaryColor }}>
            {layout.show_logo && displayIssuer?.logo_url && (
              <img 
                src={displayIssuer.logo_url} 
                alt="Logo" 
                className="h-16 w-auto mx-auto mb-3 object-contain"
              />
            )}
            <h2 className="text-xl font-bold tracking-wide uppercase">{issuerName}</h2>
            {displayIssuer?.tax_id && (
              <p className="text-xs text-muted-foreground mt-1">TIN: {displayIssuer.tax_id}</p>
            )}
            {displayIssuer?.is_vat_registered && displayIssuer?.vat_registration_number && (
              <p className="text-xs text-muted-foreground">VAT Reg: {displayIssuer.vat_registration_number}</p>
            )}
            {displayIssuer?.address && (
              <p className="text-xs text-muted-foreground">{formatAddress(displayIssuer.address)}</p>
            )}
          </div>

          {/* Invoice meta: number, date, status in a structured grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b" style={{ borderColor: `${primaryColor}30` }}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice No</p>
              <p className="font-semibold font-mono">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</p>
              <p className="font-medium">{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-0.5">
                {isImmutable && <Lock className="h-3 w-3 mr-1" />}
                {invoice.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Issuer / Recipient two-column */}
          <div className="grid md:grid-cols-2 gap-8 py-4 border-b" style={{ borderColor: `${primaryColor}30` }}>
            {layout.show_issuer_details && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Issuer</p>
                {renderIssuerDetails()}
              </div>
            )}
            {layout.show_recipient_details && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Recipient</p>
                {renderRecipientDetails()}
              </div>
            )}
          </div>

          {/* Items - formal bordered table */}
          {layout.show_line_items && (
            <div className="border rounded" style={{ borderColor: `${primaryColor}30` }}>
              {renderLineItems()}
            </div>
          )}

          {/* Totals + Payment Instructions side by side */}
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              {renderPaymentMethod(primaryColor)}
            </div>
            {layout.show_totals && (
              <div className="flex justify-end">
                <div className="p-4 rounded border" style={{ borderColor: `${primaryColor}30` }}>
                  {renderTotals()}
                </div>
              </div>
            )}
          </div>

          {/* Notes, Terms, Verification in bottom section */}
          {((layout.show_notes && invoice.notes) || (layout.show_terms && invoice.terms) || layout.show_verification_qr) && (
            <div className="border-t-2 border-b-2 py-4 space-y-4" style={{ borderColor: primaryColor }}>
              <div className="grid md:grid-cols-3 gap-4">
                {layout.show_terms && invoice.terms && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: primaryColor }}>Terms</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
                {layout.show_notes && invoice.notes && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: primaryColor }}>Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {layout.show_verification_qr && (
                  <div className="flex flex-col items-center justify-center">
                    {renderQR()}
                    {invoice.verification_id && <p className="text-xs text-muted-foreground mt-1 font-mono">{invoice.verification_id}</p>}
                    {invoice.invoice_hash && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                        Hash: {invoice.invoice_hash}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ─────────────────────────────────────────────
  // STANDARD (Professional) Layout — default
  // ─────────────────────────────────────────────
  return (
    <Card className="relative overflow-hidden bg-white dark:bg-card print:shadow-none">
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
          <span className="text-8xl font-bold text-foreground rotate-[-30deg]">INVOICEMONK</span>
        </div>
      )}

      <div className="relative z-10">
        <CardHeader className="pb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              {layout.show_logo && displayIssuer?.logo_url && (
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
                  <p className="text-sm text-muted-foreground italic mt-2 max-w-md">{invoice.summary}</p>
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
          {/* From / To */}
          <div className="grid md:grid-cols-2 gap-8">
            {layout.show_issuer_details && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>From</p>
                {renderIssuerDetails()}
              </div>
            )}
            {layout.show_recipient_details && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Bill To</p>
                {renderRecipientDetails()}
              </div>
            )}
          </div>

          <Separator style={{ backgroundColor: primaryColor, opacity: 0.2 }} />

          {/* Line Items */}
          {layout.show_line_items && renderLineItems()}

          {/* Totals */}
          {layout.show_totals && (
            <div className="flex justify-end">
              {renderTotals()}
            </div>
          )}

          {/* Payment Instructions */}
          {renderPaymentMethod(primaryColor)}

          {/* Notes & Terms */}
          {(layout.show_notes || layout.show_terms) && (invoice.notes || invoice.terms) && (
            <>
              <Separator />
              <div className="grid md:grid-cols-2 gap-6">
                {layout.show_notes && invoice.notes && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {layout.show_terms && invoice.terms && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Terms & Conditions</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Verification */}
          {layout.show_verification_qr && (
            <div className="pt-4 border-t border-dashed flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: primaryColor }}>Verification</p>
                {invoice.verification_id && (
                  <p className="text-xs text-muted-foreground">
                    ID: <span className="font-mono">{invoice.verification_id}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {invoice.verification_id ? 'Scan QR code or visit the verification portal to verify this invoice' : 'Verification QR will be generated on issue'}
                </p>
              </div>
              {renderQR()}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
