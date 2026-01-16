import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Ban, 
  FileText, 
  Loader2, 
  Shield, 
  Clock,
  Building2,
  User,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCreditNote } from '@/hooks/use-credit-notes';

interface IssuerSnapshot {
  legal_name?: string;
  name?: string;
  tax_id?: string;
  jurisdiction?: string;
  contact_email?: string;
}

interface RecipientSnapshot {
  name?: string;
  email?: string;
  tax_id?: string;
}

export default function CreditNoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: creditNote, isLoading, error } = useCreditNote(id);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !creditNote) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Credit Note Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Ban className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">This credit note doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/credit-notes')}>Back to Credit Notes</Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const originalInvoice = creditNote.original_invoice;
  const issuerSnapshot = originalInvoice?.issuer_snapshot as IssuerSnapshot | null;
  const recipientSnapshot = originalInvoice?.recipient_snapshot as RecipientSnapshot | null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{creditNote.credit_note_number}</h1>
              <Badge className="bg-destructive/10 text-destructive">
                <Ban className="h-3 w-3 mr-1" />
                Credit Note
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Reverses invoice {originalInvoice?.invoice_number}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/invoices/${creditNote.original_invoice_id}`}>
              <FileText className="h-4 w-4 mr-2" />
              View Original Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Immutability Notice */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="flex items-center gap-4 py-4">
          <Lock className="h-5 w-5 text-blue-500" />
          <div>
            <p className="font-medium text-blue-700 dark:text-blue-400">This credit note is immutable</p>
            <p className="text-sm text-muted-foreground">
              Created on {formatDateTime(creditNote.issued_at)} and cannot be altered.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Credit Note Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-destructive" />
                Credit Note Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Credit Note Number</p>
                  <p className="font-medium">{creditNote.credit_note_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Original Invoice</p>
                  <Link 
                    to={`/invoices/${creditNote.original_invoice_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {originalInvoice?.invoice_number}
                  </Link>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Amount Credited</p>
                  <p className="font-bold text-lg text-destructive">
                    -{formatCurrency(Number(creditNote.amount), originalInvoice?.currency || 'NGN')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium">{formatDate(creditNote.issued_at)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Reason for Void</p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{creditNote.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legal Identity Records */}
          {(issuerSnapshot || recipientSnapshot) && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Legal Identity Records
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Identity recorded at time of original invoice issuance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {issuerSnapshot && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Issuer (Business)
                    </div>
                    <div className="grid gap-2 text-sm pl-6">
                      {issuerSnapshot.legal_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Legal Name</span>
                          <span className="font-medium">{issuerSnapshot.legal_name}</span>
                        </div>
                      )}
                      {issuerSnapshot.tax_id && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax ID</span>
                          <span className="font-mono text-xs">{issuerSnapshot.tax_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {issuerSnapshot && recipientSnapshot && <Separator />}

                {recipientSnapshot && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Recipient (Client)
                    </div>
                    <div className="grid gap-2 text-sm pl-6">
                      {recipientSnapshot.name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">{recipientSnapshot.name}</span>
                        </div>
                      )}
                      {recipientSnapshot.email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span>{recipientSnapshot.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary">Finalized</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span>{originalInvoice?.currency || 'NGN'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span>{originalInvoice?.clients?.name || 'Unknown'}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Amount Credited</span>
                <span className="text-destructive">
                  -{formatCurrency(Number(creditNote.amount), originalInvoice?.currency || 'NGN')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Credit Note Created</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(creditNote.issued_at)}</p>
                  </div>
                </div>
                {originalInvoice?.issued_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium">Original Invoice Issued</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(originalInvoice.issued_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {creditNote.verification_id && (
            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-mono bg-muted p-2 rounded break-all mb-2">
                  ID: {creditNote.verification_id.slice(0, 8)}...
                </div>
                <p className="text-xs text-muted-foreground">This credit note can be publicly verified.</p>
              </CardContent>
            </Card>
          )}

          {creditNote.credit_note_hash && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Integrity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {creditNote.credit_note_hash.slice(0, 32)}...
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cryptographic hash ensures document integrity
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
