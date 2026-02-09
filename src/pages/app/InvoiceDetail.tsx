import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Lock, Download, Send, FileText, History, CheckCircle2,
  Ban, DollarSign, Loader2, Clock, AlertCircle, Building2, User, Shield, Eye, FileX
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvoice, useIssueInvoice, useVoidInvoice, useRecordPayment } from '@/hooks/use-invoices';
import { useInvoiceAuditLogs } from '@/hooks/use-audit-logs';
import { useDownloadInvoicePdf } from '@/hooks/use-invoice-pdf';
import { useCreditNoteByInvoice } from '@/hooks/use-credit-notes';
import { useInvoicePayments } from '@/hooks/use-payments';
import { InvoicePreviewDialog } from '@/components/invoices/InvoicePreviewDialog';
import { SendInvoiceDialog } from '@/components/invoices/SendInvoiceDialog';
import { useBusiness } from '@/contexts/BusinessContext';
import { BusinessAccessGuard } from '@/components/app/BusinessAccessGuard';
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
  const { data: creditNote } = useCreditNoteByInvoice(id);
  const { data: payments } = useInvoicePayments(id);
  const issueInvoice = useIssueInvoice();
  const voidInvoice = useVoidInvoice();
  const recordPayment = useRecordPayment();
  const downloadPdf = useDownloadInvoicePdf();
  const { isStarter } = useBusiness();

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

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

  const handleDownloadPdf = () => {
    if (id && invoice) {
      downloadPdf.mutate({ invoiceId: id, invoiceNumber: invoice.invoice_number });
    }
  };

  const handleVoid = async () => {
    if (id && voidReason.trim()) {
      await voidInvoice.mutateAsync({ invoiceId: id, reason: voidReason });
      setVoidDialogOpen(false);
    }
  };

  const handleRecordPayment = async () => {
    if (id && paymentAmount) {
      await recordPayment.mutateAsync({ 
        invoiceId: id, 
        amount: parseFloat(paymentAmount),
        paymentMethod: paymentMethod || undefined,
        paymentReference: paymentReference || undefined,
        paymentDate: paymentDate,
        notes: paymentNotes || undefined
      });
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentReference('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentNotes('');
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
    <BusinessAccessGuard businessId={invoice.business_id} resourceType="invoice">
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
            <>
              <Button variant="ghost" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" onClick={() => navigate(`/invoices/${id}/edit`)}>
                Edit Draft
              </Button>
              <Button onClick={handleIssue} disabled={issueInvoice.isPending}>
                {issueInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Issue Invoice
              </Button>
            </>
          )}
          {isImmutable && (
            <>
              <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadPdf.isPending}>
                {downloadPdf.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Download PDF
              </Button>
              {(invoice.status === 'issued' || invoice.status === 'sent') && (
                <Button variant="outline" onClick={() => setSendDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              )}
              {invoice.status !== 'voided' && invoice.status !== 'paid' && (
                <>
                  <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />Record Payment
                  </Button>
                  <Button variant="destructive" onClick={() => setVoidDialogOpen(true)}>
                    <Ban className="h-4 w-4 mr-2" />Void
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Immutability Notice */}
      {isImmutable && invoice.status !== 'voided' && (
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

      {/* Credit Note Notice for Voided Invoices */}
      {invoice.status === 'voided' && creditNote && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <FileX className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">This invoice has been voided</p>
                <p className="text-sm text-muted-foreground">
                  Credit note {creditNote.credit_note_number} was created on {formatDateTime(creditNote.issued_at)}.
                  Reason: {creditNote.reason}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/credit-notes/${creditNote.id}`}>
                View Credit Note
              </Link>
            </Button>
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

          {/* Payment History - Show for all issued invoices */}
          {isImmutable && invoice.status !== 'voided' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment History
                </CardTitle>
                <CardDescription>
                  {payments?.length || 0} payment{(payments?.length || 0) !== 1 ? 's' : ''} recorded
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payments && payments.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.payment_date)}</TableCell>
                            <TableCell className="capitalize">
                              {payment.payment_method?.replace('_', ' ') || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {payment.payment_reference || '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {formatCurrency(Number(payment.amount), invoice.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Payment Notes Section */}
                    {payments.some(p => p.notes) && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Payment Notes</p>
                        {payments.filter(p => p.notes).map(p => (
                          <p key={p.id} className="text-sm">
                            <span className="font-medium">{formatDate(p.payment_date)}:</span> {p.notes}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No payments recorded yet
                  </p>
                )}
                
                {/* Summary Section */}
                <Separator className="my-4" />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Invoice</span>
                    <span className="font-medium">{formatCurrency(Number(invoice.total_amount), invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(Number(invoice.amount_paid), invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className={Number(invoice.total_amount) - Number(invoice.amount_paid) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                      {formatCurrency(Number(invoice.total_amount) - Number(invoice.amount_paid), invoice.currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Record Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Outstanding: {formatCurrency(Number(invoice.total_amount) - Number(invoice.amount_paid), invoice.currency)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input 
                id="amount"
                type="number" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference / Transaction ID</Label>
              <Input 
                id="reference"
                value={paymentReference} 
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g., TXN123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Payment Date</Label>
              <Input 
                id="date"
                type="date" 
                value={paymentDate} 
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes"
                value={paymentNotes} 
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRecordPayment} 
              disabled={!paymentAmount || recordPayment.isPending}
            >
              {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Preview Dialog - for issued invoices, logo comes from issuer_snapshot */}
      {invoice && (
        <InvoicePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          invoice={invoice}
          showWatermark={isStarter}
        />
      )}

      {/* Send Invoice Dialog */}
      {invoice && (
        <SendInvoiceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          invoice={invoice}
        />
      )}
    </motion.div>
    </BusinessAccessGuard>
  );
}
