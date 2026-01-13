import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Send,
  Trash2,
  Lock,
  Ban,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInvoices, useDeleteInvoice, useVoidInvoice } from '@/hooks/use-invoices';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  viewed: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  voided: 'bg-destructive/10 text-destructive',
  credited: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  voided: 'Voided',
  credited: 'Credited',
};

export default function Invoices() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data: invoices, isLoading, error } = useInvoices();
  const deleteInvoice = useDeleteInvoice();
  const voidInvoice = useVoidInvoice();

  const filteredInvoices = (invoices || []).filter(invoice => {
    if (activeTab !== 'all' && invoice.status !== activeTab) return false;
    if (searchQuery && 
        !invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !invoice.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedInvoiceId) {
      await deleteInvoice.mutateAsync(selectedInvoiceId);
    }
    setDeleteDialogOpen(false);
    setSelectedInvoiceId(null);
  };

  const handleVoid = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const confirmVoid = async () => {
    if (selectedInvoiceId && voidReason.trim()) {
      await voidInvoice.mutateAsync({ 
        invoiceId: selectedInvoiceId, 
        reason: voidReason.trim() 
      });
    }
    setVoidDialogOpen(false);
    setSelectedInvoiceId(null);
    setVoidReason('');
  };

  const isImmutable = (status: InvoiceStatus) => status !== 'draft';

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Error loading invoices: {error.message}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your compliance-ready invoices
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="issued">Issued</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="voided">Voided</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            {isLoading ? (
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            ) : filteredInvoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link 
                          to={`/invoices/${invoice.id}`}
                          className="hover:text-primary transition-colors flex items-center gap-2"
                        >
                          {invoice.invoice_number}
                          {isImmutable(invoice.status) && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.clients?.name || 'Unknown'}</TableCell>
                      <TableCell>{formatCurrency(Number(invoice.total_amount), invoice.currency)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[invoice.status]} variant="secondary">
                          {isImmutable(invoice.status) && (
                            <Lock className="h-3 w-3 mr-1" />
                          )}
                          {statusLabels[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/invoices/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            {invoice.status === 'issued' && (
                              <DropdownMenuItem>
                                <Send className="h-4 w-4 mr-2" />
                                Send
                              </DropdownMenuItem>
                            )}
                            {invoice.status !== 'draft' && invoice.status !== 'voided' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleVoid(invoice.id)}
                                  className="text-destructive"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Void Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                            {invoice.status === 'draft' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(invoice.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">No invoices found</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    {activeTab === 'all' 
                      ? "Create your first invoice to get started with compliance-ready invoicing."
                      : `No ${activeTab} invoices found.`
                    }
                  </p>
                  <Button asChild>
                    <Link to="/invoices/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Invoice
                    </Link>
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compliance Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Immutable Invoice Records</p>
            <p className="text-xs text-muted-foreground">
              Once issued, invoices cannot be modified or deleted. This ensures compliance with financial record-keeping regulations.
              To correct an issued invoice, create a credit note by voiding it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft invoice. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvoice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Void Invoice
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action <strong>does not erase</strong> the original invoice. A credit note will be created 
                and the original invoice will be permanently marked as voided.
              </p>
              <p className="text-xs text-muted-foreground">
                A permanent audit record of this action will be created.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="voidReason">Reason for voiding (required)</Label>
            <Textarea
              id="voidReason"
              placeholder="Enter the reason for voiding this invoice..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmVoid}
              disabled={!voidReason.trim() || voidInvoice.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidInvoice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Void Invoice'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
