import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { 
  FileText, Search, Download, Eye, ExternalLink, 
  Loader2, Receipt as ReceiptIcon, Calendar, Building2, User, 
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReceipts, useDownloadReceiptPdf } from '@/hooks/use-receipts';

export default function Receipts() {
  const { businessId } = useParams<{ businessId: string }>();
  const { data: receipts, isLoading } = useReceipts();
  const downloadPdf = useDownloadReceiptPdf();
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const filteredReceipts = receipts?.filter(receipt => {
    const search = searchTerm.toLowerCase();
    const payerName = (receipt.payer_snapshot?.name || '').toLowerCase();
    const invoiceNumber = (receipt.invoice_snapshot?.invoice_number || '').toLowerCase();
    return (
      receipt.receipt_number.toLowerCase().includes(search) ||
      payerName.includes(search) ||
      invoiceNumber.includes(search)
    );
  }) || [];

  const handleDownloadPdf = (receiptId: string, receiptNumber: string) => {
    downloadPdf.mutate({ receiptId, receiptNumber });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">
            Payment receipts are automatically generated for every payment recorded.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receipts?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                receipts?.reduce((sum, r) => sum + Number(r.amount), 0) || 0,
                receipts?.[0]?.currency || 'NGN'
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {receipts?.filter(r => {
                const receiptDate = new Date(r.issued_at);
                const now = new Date();
                return receiptDate.getMonth() === now.getMonth() && 
                       receiptDate.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Receipts</CardTitle>
              <CardDescription>
                Immutable payment records with cryptographic verification
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search receipts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ReceiptIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No receipts yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Receipts are automatically generated when you record payments against invoices.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Link 
                        to={`/b/${businessId}/receipts/${receipt.id}`}
                        className="font-medium hover:underline flex items-center gap-2"
                      >
                        <ReceiptIcon className="h-4 w-4 text-emerald-500" />
                        {receipt.receipt_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {receipt.payer_snapshot?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/b/${businessId}/invoices/${receipt.invoice_id}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        {receipt.invoice_snapshot?.invoice_number || 'N/A'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(Number(receipt.amount), receipt.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(receipt.issued_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          asChild
                          title="View Receipt"
                        >
                          <Link to={`/b/${businessId}/receipts/${receipt.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownloadPdf(receipt.id, receipt.receipt_number)}
                          disabled={downloadPdf.isPending}
                          title="Download PDF"
                        >
                          {downloadPdf.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          asChild
                          title="Verify Receipt"
                        >
                          <a 
                            href={`/verify/receipt/${receipt.verification_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
