import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Calendar, 
  Building2, 
  CreditCard,
  Lock,
  ExternalLink,
  Loader2,
  User,
  MapPin,
  Phone,
  Mail
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import invoicemonkLogo from "@/assets/invoicemonk-logo.png";

interface IssuerIdentity {
  legal_name: string | null;
  name: string | null;
  tax_id: string | null;
  address: Record<string, unknown> | null;
  jurisdiction: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

interface RecipientIdentity {
  name: string | null;
  email: string | null;
  tax_id: string | null;
  address: Record<string, unknown> | null;
  phone: string | null;
}

interface VerificationResponse {
  verified: boolean;
  invoice?: {
    invoice_number: string;
    issue_date: string | null;
    issued_at: string | null;
    issuer_name: string;
    issuer_identity?: IssuerIdentity;
    recipient_identity?: RecipientIdentity;
    payment_status: string;
    total_amount: number;
    currency: string;
    integrity_valid: boolean;
    tax_schema_version?: string;
    identity_snapshot_date?: string;
  };
  error?: string;
}

const VerifyInvoice = () => {
  const { verificationId } = useParams<{ verificationId: string }>();

  const { data, isLoading, error } = useQuery<VerificationResponse>({
    queryKey: ['verify-invoice', verificationId],
    queryFn: async () => {
      const response = await fetch(
        `https://skcxogeaerudoadluexz.supabase.co/functions/v1/verify-invoice?verification_id=${verificationId}`
      );
      return response.json();
    },
    enabled: !!verificationId,
    retry: false,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatAddress = (address: Record<string, unknown> | null) => {
    if (!address) return null;
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={invoicemonkLogo} alt="InvoiceMonk" className="h-8 w-auto" />
          </Link>
          <Badge variant="secondary" className="gap-1.5">
            <Shield className="h-3 w-3" />
            Public Verification Portal
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Verifying invoice...</p>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center py-8">
                  <div className="rounded-full bg-destructive/10 p-4 mb-4">
                    <XCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Verification Failed</h2>
                  <p className="text-muted-foreground mb-6">
                    Unable to connect to the verification service. Please try again later.
                  </p>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Verification Result */}
        {!isLoading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {data.verified && data.invoice ? (
              <>
                {/* Success Header */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="inline-flex rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-4"
                  >
                    <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
                  </motion.div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-3">
                    Invoice Verified
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                    This invoice is a verified financial record issued via InvoiceMonk's 
                    compliance-first invoicing platform.
                  </p>
                </div>

                {/* Invoice Details Card */}
                <Card className="mb-6 card-shadow">
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Invoice Number */}
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Invoice Number</p>
                          <p className="font-semibold text-lg">{data.invoice.invoice_number}</p>
                        </div>
                      </div>

                      {/* Issue Date */}
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Issue Date</p>
                          <p className="font-semibold">
                            {formatDate(data.invoice.issued_at || data.invoice.issue_date)}
                          </p>
                        </div>
                      </div>

                      {/* Issuer */}
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Issued By</p>
                          <p className="font-semibold">{data.invoice.issuer_name}</p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Amount</p>
                          <p className="font-semibold text-lg">
                            {formatCurrency(data.invoice.total_amount, data.invoice.currency)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Status & Tax Schema */}
                    <div className="mt-6 pt-6 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Payment Status</span>
                        <Badge 
                          variant={
                            data.invoice.payment_status === 'Paid' ? 'default' :
                            data.invoice.payment_status === 'Voided' ? 'destructive' :
                            'secondary'
                          }
                          className="text-sm"
                        >
                          {data.invoice.payment_status}
                        </Badge>
                      </div>
                      {data.invoice.tax_schema_version && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tax Schema Version</span>
                          <span className="font-mono text-sm">{data.invoice.tax_schema_version}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Legal Identity Cards - Only if snapshots exist */}
                {(data.invoice.issuer_identity || data.invoice.recipient_identity) && (
                  <Card className="mb-6 border-green-200 dark:border-green-800">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                          <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Legal Identity Snapshot</h3>
                          <p className="text-sm text-muted-foreground">
                            Identity verified as of {formatDate(data.invoice.identity_snapshot_date || data.invoice.issued_at)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Issuer Identity */}
                        {data.invoice.issuer_identity && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                              Issuer
                            </div>
                            <div className="space-y-2 text-sm">
                              {data.invoice.issuer_identity.legal_name && (
                                <p className="font-semibold">{data.invoice.issuer_identity.legal_name}</p>
                              )}
                              {data.invoice.issuer_identity.tax_id && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Tax ID:</span>
                                  <span className="font-mono">{data.invoice.issuer_identity.tax_id}</span>
                                </div>
                              )}
                              {data.invoice.issuer_identity.jurisdiction && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span>{data.invoice.issuer_identity.jurisdiction}</span>
                                </div>
                              )}
                              {data.invoice.issuer_identity.contact_email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span>{data.invoice.issuer_identity.contact_email}</span>
                                </div>
                              )}
                              {data.invoice.issuer_identity.contact_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <span>{data.invoice.issuer_identity.contact_phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Recipient Identity */}
                        {data.invoice.recipient_identity && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <User className="h-4 w-4" />
                              Recipient
                            </div>
                            <div className="space-y-2 text-sm">
                              {data.invoice.recipient_identity.name && (
                                <p className="font-semibold">{data.invoice.recipient_identity.name}</p>
                              )}
                              {data.invoice.recipient_identity.tax_id && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Tax ID:</span>
                                  <span className="font-mono">{data.invoice.recipient_identity.tax_id}</span>
                                </div>
                              )}
                              {data.invoice.recipient_identity.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span>{data.invoice.recipient_identity.email}</span>
                                </div>
                              )}
                              {data.invoice.recipient_identity.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <span>{data.invoice.recipient_identity.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Integrity Check Card */}
                <Card className={`mb-6 ${data.invoice.integrity_valid ? 'border-green-200 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`rounded-lg p-2 ${data.invoice.integrity_valid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                        <Lock className={`h-6 w-6 ${data.invoice.integrity_valid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">
                          {data.invoice.integrity_valid ? 'Document Integrity Confirmed' : 'Integrity Check Pending'}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {data.invoice.integrity_valid 
                            ? 'This invoice has a cryptographic hash that confirms it has not been modified since issuance. The original record remains intact.'
                            : 'Integrity verification is in progress or the hash has not been generated yet.'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Footer */}
                <div className="text-center pt-6 pb-4">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-full px-4 py-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Verified via InvoiceMonk Compliance Platform</span>
                  </div>
                </div>
              </>
            ) : (
              /* Not Found / Error State */
              <Card className="border-destructive/30">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center py-8">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                      <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Invoice Not Verified</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      {data.error || 'This verification ID does not match any issued invoice in our system.'}
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" asChild>
                        <Link to="/">Return Home</Link>
                      </Button>
                      <Button asChild>
                        <Link to="/contact">
                          Contact Support
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
                  <h2 className="text-2xl font-semibold mb-2">Invoice Verification</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    To verify an invoice, you need a valid verification link. 
                    This link is typically provided on the invoice document or by the issuing party.
                  </p>
                  <Button variant="outline" asChild>
                    <Link to="/">Return Home</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            InvoiceMonk provides compliance-first invoicing with immutable audit trails. 
            Every invoice issued through our platform is verifiable and tamper-evident.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <Link to="/compliance" className="text-muted-foreground hover:text-foreground transition-colors">
              Compliance
            </Link>
            <span className="text-border">•</span>
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <span className="text-border">•</span>
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VerifyInvoice;
