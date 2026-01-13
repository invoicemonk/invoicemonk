import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Lock, Download, Send, FileText, History, CheckCircle2,
  Ban, DollarSign, Loader2, Clock, AlertCircle, Building2, User, Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useInvoice, useIssueInvoice, useVoidInvoice, useRecordPayment } from '@/hooks/use-invoices';
import { useInvoiceAuditLogs } from '@/hooks/use-audit-logs';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

interface IssuerSnapshot {
  legal_name?: string;
  name?: string;
  tax_id?: string;
  address?: Record<string, unknown>;
  jurisdiction?: string;
  contact_email?: string;
  contact_phone?: string;
}

interface RecipientSnapshot {
  name?: string;
  email?: string;
  tax_id?: string;
  address?: Record<string, unknown>;
  phone?: string;
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-blue-500/10 text-blue-600',
  sent: 'bg-amber-500/10 text-amber-600',
  viewed: 'bg-purple-500/10 text-purple-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  voided: 'bg-destructive/10 text-destructive',
  credited: 'bg-orange-500/10 text-orange-600',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: invoice, isLoading, error } = useInvoice(id);
  const { data: auditLogs } = useInvoiceAuditLogs(id);
  const issueInvoice = useIssueInvoice();
  const voidInvoice = useVoidInvoice();
  const recordPayment = useRecordPayment();

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const isImmutable = invoice?.status !== 'draft';
  
  // Parse snapshots
  const issuerSnapshot = invoice?.issuer_snapshot as IssuerSnapshot | null;
  const recipientSnapshot = invoice?.recipient_snapshot as RecipientSnapshot | null;
  const hasSnapshots = !!issuerSnapshot || !!recipientSnapshot;

  const handleIssue = async () => {
    if (id) await issueInvoice.mutateAsync(id);
  };

  const handleVoid = async () => {
    if (id && voidReason.trim()) {
      await voidInvoice.mutateAsync({ invoiceId: id, reason: voidReason });
      setVoidDialogOpen(false);
    }
  };

  const handleRecordPayment = async () => {
    if (id && paymentAmount) {
      await recordPayment.mutateAsync({ invoiceId: id, amount: parseFloat(paymentAmount) });
      setPaymentDialogOpen(false);
      setPaymentAmount('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-3xl font-bold">Invoice Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">This invoice doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/invoices')}>Back to Invoices</Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
              <Badge className={statusColors[invoice.status]}>
                {isImmutable && <Lock className="h-3 w-3 mr-1" />}
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground">{invoice.clients?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <Button onClick={handleIssue} disabled={issueInvoice.isPending}>
              {issueInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Issue Invoice
            </Button>
          )}
          {isImmutable && invoice.status !== 'voided' && invoice.status !== 'paid' && (
            <>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                <DollarSign className="h-4 w-4 mr-2" />Record Payment
              </Button>
              <Button variant="destructive" onClick={() => setVoidDialogOpen(true)}>
                <Ban className="h-4 w-4 mr-2" />Void
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Immutability Notice */}
      {isImmutable && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="flex items-center gap-4 py-4">
            <Lock className="h-5 w-5 text-blue-500" />
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-400">This invoice is immutable</p>
              <p className="text-sm text-muted-foreground">
                Issued on {formatDateTime(invoice.issued_at || invoice.created_at)} and cannot be altered.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent>
              {invoice.invoice_items && invoice.invoice_items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.invoice_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.unit_price), invoice.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.amount), invoice.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No line items</p>
              )}
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(Number(invoice.tax_amount), invoice.currency)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatCurrency(Number(invoice.total_amount), invoice.currency)}</span></div>
                {Number(invoice.amount_paid) > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>Paid</span><span>-{formatCurrency(Number(invoice.amount_paid), invoice.currency)}</span></div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Legal Identity Snapshots - Only shown for issued invoices */}
          {isImmutable && hasSnapshots && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Legal Identity Records
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Identity recorded at time of issuance ({formatDateTime(invoice.issued_at || invoice.created_at)})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Issuer Snapshot */}
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
                      {issuerSnapshot.name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Business Name</span>
                          <span>{issuerSnapshot.name}</span>
                        </div>
                      )}
                      {issuerSnapshot.tax_id && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax ID</span>
                          <span className="font-mono text-xs">{issuerSnapshot.tax_id}</span>
                        </div>
                      )}
                      {issuerSnapshot.jurisdiction && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Jurisdiction</span>
                          <span>{issuerSnapshot.jurisdiction}</span>
                        </div>
                      )}
                      {issuerSnapshot.contact_email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span>{issuerSnapshot.contact_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {issuerSnapshot && recipientSnapshot && <Separator />}

                {/* Recipient Snapshot */}
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
                      {recipientSnapshot.tax_id && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax ID</span>
                          <span className="font-mono text-xs">{recipientSnapshot.tax_id}</span>
                        </div>
                      )}
                      {recipientSnapshot.phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span>{recipientSnapshot.phone}</span>
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
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Issue Date</span><span>{formatDate(invoice.issue_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{formatDate(invoice.due_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{invoice.currency}</span></div>
              {invoice.tax_schema_version && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Schema</span>
                  <span className="font-mono text-xs">{invoice.tax_schema_version}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs?.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium">{log.event_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp_utc)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                <Link to="/audit-logs">View Full Log</Link>
              </Button>
            </CardContent>
          </Card>

          {invoice.verification_id && (
            <Card>
              <CardHeader><CardTitle>Verification</CardTitle></CardHeader>
              <CardContent>
                <div className="text-xs font-mono bg-muted p-2 rounded break-all mb-2">
                  ID: {invoice.verification_id.slice(0, 8)}...
                </div>
                <p className="text-xs text-muted-foreground">This invoice can be publicly verified.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Void Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" />Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              This does not erase the original invoice. A credit note will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason (required)</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className="mt-2" placeholder="Enter reason..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={!voidReason.trim()} className="bg-destructive text-destructive-foreground">
              Void Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <AlertDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Outstanding: {formatCurrency(Number(invoice.total_amount) - Number(invoice.amount_paid), invoice.currency)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Amount</Label>
            <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecordPayment} disabled={!paymentAmount}>Record Payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
