import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CheckCircle2, XCircle, Shield, Building2, Calendar, 
  Receipt as ReceiptIcon, Loader2, ExternalLink, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useVerifyReceipt } from '@/hooks/use-receipts';
import logo from '@/assets/invoicemonk-logo.png';

export default function VerifyReceipt() {
  const { verificationId } = useParams<{ verificationId: string }>();
  const { data, isLoading, error } = useVerifyReceipt(verificationId);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const verificationUrl = `${window.location.origin}/verify/receipt/${verificationId}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying receipt...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.verified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-2xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="flex justify-center mb-8">
            <Link to="/">
              <img src={logo} alt="Invoicemonk" className="h-10" />
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-destructive/50">
              <CardContent className="flex flex-col items-center py-12">
                <div className="rounded-full bg-destructive/10 p-4 mb-4">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
                <p className="text-muted-foreground text-center max-w-sm mb-6">
                  {(error as Error)?.message || data?.error || 'This receipt could not be verified. It may not exist or has been tampered with.'}
                </p>
                <Button asChild>
                  <Link to="/">Return to Invoicemonk</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  const receipt = data.receipt;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 print:bg-white">
      <div className="container max-w-3xl mx-auto px-4 py-8 print:py-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 print:mb-4">
          <Link to="/">
            <img src={logo} alt="Invoicemonk" className="h-10 print:h-8" />
          </Link>
          <Badge 
            variant="outline" 
            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 print:bg-emerald-100"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified Receipt
          </Badge>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Verification Status Card */}
          <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 print:bg-emerald-50">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <Shield className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  Receipt Verified
                </h2>
                <p className="text-sm text-muted-foreground">
                  This receipt is authentic and has not been tampered with.
                </p>
              </div>
              {receipt.integrity_valid ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Integrity Valid
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Integrity Issue
                </Badge>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Receipt Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptIcon className="h-5 w-5 text-emerald-500" />
                    Receipt Details
                  </CardTitle>
                  <CardDescription>
                    {receipt.receipt_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Amount */}
                  <div className="text-center py-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Amount Received</p>
                    <p className="text-4xl font-bold text-emerald-600">
                      {formatCurrency(receipt.amount, receipt.currency)}
                    </p>
                  </div>

                  <Separator />

                  {/* Details Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Building2 className="h-4 w-4" />
                        Issued By
                      </div>
                      <p className="font-medium">{receipt.issuer_name}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Building2 className="h-4 w-4" />
                        Paid By
                      </div>
                      <p className="font-medium">{receipt.payer_name}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        Payment Date
                      </div>
                      <p className="font-medium">{formatDate(receipt.payment_date)}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <ReceiptIcon className="h-4 w-4" />
                        Invoice Reference
                      </div>
                      <p className="font-medium">{receipt.invoice_reference}</p>
                    </div>
                  </div>

                  {receipt.payment_method && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                      <p className="font-medium capitalize">
                        {receipt.payment_method.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* QR Code */}
              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle className="text-lg">Verification QR</CardTitle>
                  <CardDescription>
                    Scan to verify this receipt
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg shadow-sm">
                    <QRCodeSVG value={verificationUrl} size={140} />
                  </div>
                </CardContent>
              </Card>

              {/* Issue Date */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Issue Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium">
                    {formatDate(receipt.issued_at)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-8 print:py-4">
            <p className="text-sm text-muted-foreground mb-4">
              This receipt was verified through Invoicemonk's secure verification system.
            </p>
            <Button asChild className="print:hidden">
              <Link to="/">
                <ExternalLink className="h-4 w-4 mr-2" />
                Learn more about Invoicemonk
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
