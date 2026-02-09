import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, Download, Lock, Shield, FileText, 
  Building2, User, Calendar, CreditCard, ExternalLink, 
  Loader2, CheckCircle2, Receipt as ReceiptIcon, Copy
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useReceipt, useDownloadReceiptPdf } from '@/hooks/use-receipts';
import { BusinessAccessGuard } from '@/components/app/BusinessAccessGuard';
import { toast } from 'sonner';

export default function ReceiptDetail() {
  const { id, businessId } = useParams<{ id: string; businessId: string }>();
  const navigate = useNavigate();
  const { data: receipt, isLoading, error } = useReceipt(id);
  const downloadPdf = useDownloadReceiptPdf();

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

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleDownloadPdf = () => {
    if (receipt) {
      downloadPdf.mutate({ receiptId: receipt.id, receiptNumber: receipt.receipt_number });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const verificationUrl = receipt 
    ? `${window.location.origin}/verify/receipt/${receipt.verification_id}` 
    : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Receipt Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <ReceiptIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">This receipt doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate(`/b/${businessId}/receipts`)}>Back to Receipts</Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const issuer = receipt.issuer_snapshot;
  const payer = receipt.payer_snapshot;
  const invoice = receipt.invoice_snapshot;
  const payment = receipt.payment_snapshot;
  const issuerAddress = (issuer?.address as Record<string, string>) || {};

  return (
    <BusinessAccessGuard businessId={receipt.business_id} resourceType="receipt">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{receipt.receipt_number}</h1>
              <Badge className="bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </div>
            <p className="text-muted-foreground">Payment receipt for {payer?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadPdf.isPending}>
            {downloadPdf.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button variant="outline" asChild>
            <a href={verificationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Public Link
            </a>
          </Button>
        </div>
      </div>

      {/* Immutability Notice */}
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="flex items-center gap-4 py-4">
          <Lock className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              This receipt is immutable and cryptographically verified
            </p>
            <p className="text-sm text-muted-foreground">
              Issued on {formatDateTime(receipt.issued_at)} and cannot be altered.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Amount Card */}
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Amount Received</p>
                <p className="text-4xl font-bold text-emerald-600">
                  {formatCurrency(Number(receipt.amount), receipt.currency)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Party Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Party Information
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Snapshot recorded at time of payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Issuer */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Issuer (Business)
                </div>
                <div className="grid gap-2 text-sm pl-6">
                  {issuer?.legal_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Legal Name</span>
                      <span className="font-medium">{issuer.legal_name}</span>
                    </div>
                  )}
                  {issuer?.name && issuer.name !== issuer.legal_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Business Name</span>
                      <span>{issuer.name}</span>
                    </div>
                  )}
                  {issuer?.tax_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ID</span>
                      <span className="font-mono text-xs">{issuer.tax_id}</span>
                    </div>
                  )}
                  {issuer?.contact_email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span>{issuer.contact_email}</span>
                    </div>
                  )}
                  {issuerAddress.city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span>{issuerAddress.city}, {issuerAddress.country}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Payer */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Payer (Client)
                </div>
                <div className="grid gap-2 text-sm pl-6">
                  {payer?.name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{payer.name}</span>
                    </div>
                  )}
                  {payer?.email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span>{payer.email}</span>
                    </div>
                  )}
                  {payer?.tax_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ID</span>
                      <span className="font-mono text-xs">{payer.tax_id}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Payment Date</span>
                  <span className="font-medium">{formatDate(payment?.payment_date || receipt.issued_at)}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium capitalize">
                    {payment?.payment_method?.replace(/_/g, ' ') || 'Not specified'}
                  </span>
                </div>
              </div>
              {payment?.payment_reference && (
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-sm">{payment.payment_reference}</span>
                </div>
              )}
              {payment?.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground block mb-1">Notes</span>
                  <span className="text-sm">{payment.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{invoice?.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Invoice Total: {formatCurrency(invoice?.total_amount || 0, receipt.currency)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/b/${businessId}/invoices/${receipt.invoice_id}`}>
                    View Invoice
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Verification Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verification</CardTitle>
              <CardDescription>
                Scan QR code or visit the link to verify this receipt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={verificationUrl} size={160} />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Verification ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded font-mono truncate">
                    {receipt.verification_id}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="shrink-0"
                    onClick={() => copyToClipboard(receipt.verification_id, 'Verification ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integrity Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">SHA-256 Hash</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all">
                    {receipt.receipt_hash}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="shrink-0"
                    onClick={() => copyToClipboard(receipt.receipt_hash, 'Hash')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issued At</span>
                  <span>{formatDateTime(receipt.issued_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retention Until</span>
                  <span>{formatDate(receipt.retention_locked_until)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
    </BusinessAccessGuard>
  );
}
