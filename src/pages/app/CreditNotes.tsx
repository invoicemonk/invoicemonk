import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  FileX, 
  Search,
  Loader2,
  ArrowRight,
  Ban,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCreditNotes } from '@/hooks/use-credit-notes';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useState } from 'react';

export default function CreditNotes() {
  const [searchQuery, setSearchQuery] = useState('');
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount } = useCurrencyAccount();
  const { data: creditNotes, isLoading, error } = useCreditNotes(currentBusiness?.id, currentCurrencyAccount?.id);

  const filteredCreditNotes = (creditNotes || []).filter(cn => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cn.credit_note_number.toLowerCase().includes(query) ||
      cn.original_invoice?.invoice_number?.toLowerCase().includes(query) ||
      cn.original_invoice?.clients?.name?.toLowerCase().includes(query) ||
      cn.reason?.toLowerCase().includes(query)
    );
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Error loading credit notes: {error.message}</p>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credit Notes</h1>
        <p className="text-muted-foreground mt-1">
          View credit notes created from voided invoices
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search credit notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5" />
            All Credit Notes
          </CardTitle>
          <CardDescription>
            Credit notes are created when invoices are voided
          </CardDescription>
        </CardHeader>
        {isLoading ? (
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        ) : filteredCreditNotes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credit Note #</TableHead>
                <TableHead>Original Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCreditNotes.map((cn) => (
                <TableRow key={cn.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-destructive" />
                      {cn.credit_note_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/invoices/${cn.original_invoice_id}`}
                      className="text-primary hover:underline"
                    >
                      {cn.original_invoice?.invoice_number || 'N/A'}
                    </Link>
                  </TableCell>
                  <TableCell>{cn.original_invoice?.clients?.name || 'Unknown'}</TableCell>
                  <TableCell className="text-destructive font-medium">
                    -{formatCurrency(Number(cn.amount), cn.original_invoice?.currency || 'NGN')}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={cn.reason}>
                    {cn.reason}
                  </TableCell>
                  <TableCell>{formatDate(cn.issued_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/credit-notes/${cn.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileX className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No credit notes found</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Credit notes are automatically created when you void an issued invoice.
              </p>
              <Button variant="outline" asChild>
                <Link to="/invoices">
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoices
                </Link>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Info Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <Ban className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">What are Credit Notes?</p>
            <p className="text-xs text-muted-foreground">
              Credit notes are financial documents that reverse a previously issued invoice. 
              When you void an invoice, a credit note is automatically created to maintain proper audit trails.
              Original invoices are preserved and marked as voided.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
