import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText,
  Calendar,
  Building2,
  CreditCard,
  Download,
  Shield,
  Mail,
  Loader2,
  User,
  MapPin,
  Phone,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import invoicemonkLogo from "@/assets/invoicemonk-logo.png";
import InvoicemonkCTA from "@/components/public/InvoicemonkCTA";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate: number;
  tax_amount: number;
  discount_percent: number;
}

interface IssuerIdentity {
  legal_name?: string;
  name?: string;
  tax_id?: string;
  cac_number?: string;
  vat_registration_number?: string;
  is_vat_registered?: boolean;
  jurisdiction?: string;
  address?: Record<string, string>;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
}

interface RecipientIdentity {
  name?: string;
  email?: string;
  tax_id?: string;
  cac_number?: string;
  address?: Record<string, string>;
  phone?: string;
}

interface PaymentMethodSnapshot {
  provider_type: string;
  display_name: string;
  instructions: Record<string, string>;
}

interface InvoiceViewResponse {
  success: boolean;
  invoice?: {
    invoice_number: string;
    issue_date: string | null;
    due_date: string | null;
    status: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    amount_paid: number;
    currency: string;
    notes: string | null;
    terms: string | null;
    issuer_snapshot: IssuerIdentity | null;
    recipient_snapshot: RecipientIdentity | null;
    payment_method_snapshot: PaymentMethodSnapshot | null;
    items: InvoiceItem[];
    verification_id: string;
  };
  issuer_tier?: string;
  error?: string;
}

const InvoiceView = () => {
  const { verificationId } = useParams<{ verificationId: string }>();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data, isLoading, error } = useQuery<InvoiceViewResponse>({
    queryKey: ["view-invoice", verificationId],
    queryFn: async () => {
      const response = await fetch(
        `https://skcxogeaerudoadluexz.supabase.co/functions/v1/view-invoice?verification_id=${verificationId}`
      );
      return response.json();
    },
    enabled: !!verificationId,
    retry: false,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not specified";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const formatAddress = (address: Record<string, string> | undefined) => {
    if (!address) return null;
    const parts = [
      address.street || address.line1,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { variant: "default" | "secondary" | "destructive"; label: string }
    > = {
      issued: { variant: "secondary", label: "Issued" },
      sent: { variant: "secondary", label: "Sent" },
      viewed: { variant: "secondary", label: "Viewed" },
      paid: { variant: "default", label: "Paid" },
      voided: { variant: "destructive", label: "Voided" },
      credited: { variant: "destructive", label: "Credited" },
    };
    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDownloadPdf = async () => {
    if (!verificationId) return;

    setDownloadingPdf(true);
    try {
      const response = await fetch(
        `https://skcxogeaerudoadluexz.supabase.co/functions/v1/generate-pdf?verification_id=${verificationId}`
      );

      if (!response.ok) throw new Error("Failed to generate PDF");

      const html = await response.text();

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
        toast.success("Invoice opened for printing/download");
      } else {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Invoice-${data?.invoice?.invoice_number || "download"}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Invoice downloaded. Open and print to save as PDF.");
      }
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleContactBusiness = (email: string) => {
    const subject = encodeURIComponent(
      `Regarding Invoice ${data?.invoice?.invoice_number}`
    );
    window.location.href = `mailto:${email}?subject=${subject}`;
  };

  const invoice = data?.invoice;
  const balanceDue = invoice
    ? invoice.total_amount - (invoice.amount_paid || 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={invoicemonkLogo}
              alt="InvoiceMonk"
              className="h-8 w-auto"
            />
          </Link>
          <Badge variant="secondary" className="gap-1.5">
            <FileText className="h-3 w-3" />
            Invoice View
          </Badge>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 md:py-12 w-full">
        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading invoice...</p>
          </motion.div>
        )}

        {/* Error State */}
        {(error || (data && !data.success)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center py-8">
                  <div className="rounded-full bg-destructive/10 p-4 mb-4">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Invoice Not Found
                  </h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    {data?.error ||
                      "This invoice could not be found. Please check the link or contact the business that sent you this invoice."}
                  </p>
                  <Button variant="outline" asChild>
                    <a href="https://invoicemonk.com">Return Home</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Invoice Content */}
        {!isLoading && !error && invoice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Business Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  {/* Issuer Info */}
                  <div className="flex items-start gap-4">
                    {invoice.issuer_snapshot?.logo_url && (
                      <img
                        src={invoice.issuer_snapshot.logo_url}
                        alt="Business Logo"
                        className="h-16 w-16 object-contain rounded-lg border border-border"
                      />
                    )}
                    <div>
                      <h1 className="text-2xl font-bold">
                        {invoice.issuer_snapshot?.legal_name ||
                          invoice.issuer_snapshot?.name ||
                          "Business"}
                      </h1>
                      {formatAddress(invoice.issuer_snapshot?.address) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {formatAddress(invoice.issuer_snapshot?.address)}
                        </p>
                      )}
                      {invoice.issuer_snapshot?.contact_email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {invoice.issuer_snapshot.contact_email}
                        </p>
                      )}
                      {invoice.issuer_snapshot?.contact_phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {invoice.issuer_snapshot.contact_phone}
                        </p>
                      )}
                      {/* Tax Identification */}
                      {invoice.issuer_snapshot?.tax_id && (
                        <p className="text-sm text-muted-foreground mt-1 font-mono">
                          TIN: {invoice.issuer_snapshot.tax_id}
                        </p>
                      )}
                      {/* CAC/Registration Number */}
                      {invoice.issuer_snapshot?.cac_number && (
                        <p className="text-sm text-muted-foreground font-mono">
                          {invoice.issuer_snapshot?.jurisdiction === 'NG' ? 'CAC' : 
                           invoice.issuer_snapshot?.jurisdiction === 'GB' ? 'Co. No' :
                           invoice.issuer_snapshot?.jurisdiction === 'DE' ? 'HRB' :
                           invoice.issuer_snapshot?.jurisdiction === 'FR' ? 'SIRET' : 'Reg No'}: {invoice.issuer_snapshot.cac_number}
                        </p>
                      )}
                      {invoice.issuer_snapshot?.vat_registration_number && (
                        <p className="text-sm text-muted-foreground font-mono">
                          VAT Reg: {invoice.issuer_snapshot.vat_registration_number}
                        </p>
                      )}
                      {/* VAT Invoice Badge */}
                      {invoice.issuer_snapshot?.is_vat_registered && (
                        <Badge variant="secondary" className="mt-2">
                          VAT Invoice
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Invoice Meta */}
                  <div className="text-right">
                    <h2 className="text-3xl font-bold text-primary">INVOICE</h2>
                    <p className="text-xl font-semibold mt-1">
                      {invoice.invoice_number}
                    </p>
                    <div className="mt-2">{getStatusBadge(invoice.status)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Bill To */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Bill To
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold text-lg">
                    {invoice.recipient_snapshot?.name || "Client"}
                  </p>
                  {invoice.recipient_snapshot?.email && (
                    <p className="text-sm text-muted-foreground">
                      {invoice.recipient_snapshot.email}
                    </p>
                  )}
                  {invoice.recipient_snapshot?.phone && (
                    <p className="text-sm text-muted-foreground">
                      {invoice.recipient_snapshot.phone}
                    </p>
                  )}
                  {formatAddress(invoice.recipient_snapshot?.address) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatAddress(invoice.recipient_snapshot?.address)}
                    </p>
                  )}
                  {/* Client Tax ID */}
                  {invoice.recipient_snapshot?.tax_id && (
                    <p className="text-sm text-muted-foreground mt-2 font-mono">
                      TIN: {invoice.recipient_snapshot.tax_id}
                    </p>
                  )}
                  {/* Client CAC Number (for Nigerian companies) */}
                  {invoice.recipient_snapshot?.cac_number && (
                    <p className="text-sm text-muted-foreground font-mono">
                      CAC: {invoice.recipient_snapshot.cac_number}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Summary */}
              <Card className="bg-muted/30">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Issue Date
                    </span>
                    <span className="font-medium">
                      {formatDate(invoice.issue_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Due Date
                    </span>
                    <span className="font-medium">
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between pt-2">
                    <span className="font-semibold text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Amount Due
                    </span>
                    <span className="font-bold text-xl text-primary">
                      {formatCurrency(balanceDue, invoice.currency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price, invoice.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.amount, invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className="mt-6 flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                      </span>
                    </div>
                    {invoice.tax_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>
                          {formatCurrency(invoice.tax_amount, invoice.currency)}
                        </span>
                      </div>
                    )}
                    {invoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="text-accent-foreground">
                          -
                          {formatCurrency(
                            invoice.discount_amount,
                            invoice.currency
                          )}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>
                        {formatCurrency(invoice.total_amount, invoice.currency)}
                      </span>
                    </div>
                    {invoice.amount_paid > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-accent-foreground">
                          <span>Paid</span>
                          <span>
                            -
                            {formatCurrency(
                              invoice.amount_paid,
                              invoice.currency
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                          <span>Balance Due</span>
                          <span className="text-primary">
                            {formatCurrency(balanceDue, invoice.currency)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Instructions */}
            {invoice.payment_method_snapshot && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Payment Instructions
                    <Badge variant="outline" className="text-xs">
                      {invoice.payment_method_snapshot.display_name}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {invoice.payment_method_snapshot.provider_type === 'other' && invoice.payment_method_snapshot.instructions?.details ? (
                    <p className="text-sm whitespace-pre-wrap">{invoice.payment_method_snapshot.instructions.details}</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(invoice.payment_method_snapshot.instructions || {}).map(([key, value]) => (
                        value && (
                          <div key={key} className="flex justify-between gap-4 text-sm">
                            <span className="text-muted-foreground shrink-0 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-mono text-right truncate">{value}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Reference</span>
                      <span className="font-mono font-medium">{invoice.invoice_number}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes & Terms */}
            {(invoice.notes || invoice.terms) && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {invoice.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Notes
                      </h4>
                      <p className="text-sm">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Terms & Conditions
                      </h4>
                      <p className="text-sm">{invoice.terms}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    variant="default"
                    size="lg"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download Invoice
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                  >
                    <Link to={`/verify/invoice/${invoice.verification_id}`}>
                      <Shield className="mr-2 h-4 w-4" />
                      Verify Authenticity
                    </Link>
                  </Button>

                  {invoice.issuer_snapshot?.contact_email && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        handleContactBusiness(
                          invoice.issuer_snapshot!.contact_email!
                        )
                      }
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contact Business
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Registration CTA */}
            <InvoicemonkCTA />
          </motion.div>
        )}

        {/* No Verification ID */}
        {!verificationId && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center py-8">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">View Invoice</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    To view an invoice, you need a valid link. This link is
                    typically provided in the email from the issuing business.
                  </p>
                  <Button variant="outline" asChild>
                    <a href="https://invoicemonk.com">Return Home</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by InvoiceMonk — Compliance-first invoicing with immutable
            audit trails.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <Link
              to="/signup"
              className="text-primary hover:underline transition-colors"
            >
              Start Free
            </Link>
            <span className="text-border">•</span>
            <a
              href="https://invoicemonk.com"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InvoiceView;
