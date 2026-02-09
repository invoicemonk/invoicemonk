import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  FileText, Search, Download, Eye, ExternalLink, 
  Receipt as ReceiptIcon, Calendar, User, CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DemoLayout } from './DemoLayout';

// Sample receipt data
const sampleReceipts = [
  {
    id: '1',
    receipt_number: 'RCT-2026-001',
    payer_name: 'Afritech Solutions Ltd',
    invoice_number: 'INV-2026-001',
    invoice_id: '1',
    amount: 850000,
    currency: 'NGN',
    issued_at: '2026-02-01T14:30:00Z',
    payment_method: 'Bank Transfer',
    verification_id: 'abc123'
  },
  {
    id: '2',
    receipt_number: 'RCT-2026-002',
    payer_name: 'Naija Logistics',
    invoice_number: 'INV-2026-005',
    invoice_id: '5',
    amount: 680000,
    currency: 'NGN',
    issued_at: '2026-02-07T09:15:00Z',
    payment_method: 'Cash',
    verification_id: 'def456'
  },
  {
    id: '3',
    receipt_number: 'RCT-2026-003',
    payer_name: 'West African Trade Co',
    invoice_number: 'INV-2026-007',
    invoice_id: '7',
    amount: 1500000,
    currency: 'NGN',
    issued_at: '2026-01-28T16:45:00Z',
    payment_method: 'Cheque',
    verification_id: 'ghi789'
  },
  {
    id: '4',
    receipt_number: 'RCT-2026-004',
    payer_name: 'Green Energy Nigeria',
    invoice_number: 'INV-2026-002',
    invoice_id: '2',
    amount: 225000,
    currency: 'NGN',
    issued_at: '2026-02-05T11:00:00Z',
    payment_method: 'Bank Transfer',
    verification_id: 'jkl012'
  },
  {
    id: '5',
    receipt_number: 'RCT-2026-005',
    payer_name: 'Fintech Partners',
    invoice_number: 'INV-2026-003',
    invoice_id: '3',
    amount: 600000,
    currency: 'NGN',
    issued_at: '2026-02-08T13:20:00Z',
    payment_method: 'Bank Transfer',
    verification_id: 'mno345'
  },
];

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, yyyy');
};

// Stats
const totalAmount = sampleReceipts.reduce((sum, r) => sum + r.amount, 0);
const thisMonthReceipts = sampleReceipts.filter(r => {
  const receiptDate = new Date(r.issued_at);
  return receiptDate.getMonth() === 1 && receiptDate.getFullYear() === 2026; // February 2026
});

export default function DemoReceipts() {
  return (
    <DemoLayout>
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
              <div className="text-2xl font-bold">{sampleReceipts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Received</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalAmount)}
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
                {thisMonthReceipts.length}
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
                  className="pl-9"
                  disabled
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                {sampleReceipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        <ReceiptIcon className="h-4 w-4 text-emerald-500" />
                        {receipt.receipt_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {receipt.payer_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-primary flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {receipt.invoice_number}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(receipt.amount, receipt.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(receipt.issued_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="View Receipt">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Verify Receipt">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </DemoLayout>
  );
}
