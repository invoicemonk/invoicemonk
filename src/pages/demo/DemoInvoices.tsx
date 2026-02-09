import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, Plus, Search, Filter, Eye, Send, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DemoLayout } from './DemoLayout';

type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'viewed' | 'paid' | 'voided';

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  viewed: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  voided: 'bg-destructive/10 text-destructive',
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  voided: 'Voided',
};

// Sample Nigerian business data
const sampleInvoices = [
  { 
    id: '1',
    invoice_number: 'INV-2026-001', 
    client: 'Afritech Solutions Ltd', 
    status: 'paid' as InvoiceStatus, 
    total_amount: 850000,
    issue_date: '2026-02-01',
    due_date: '2026-02-15',
    currency: 'NGN'
  },
  { 
    id: '2',
    invoice_number: 'INV-2026-002', 
    client: 'Green Energy Nigeria', 
    status: 'sent' as InvoiceStatus, 
    total_amount: 450000,
    issue_date: '2026-02-03',
    due_date: '2026-02-17',
    currency: 'NGN'
  },
  { 
    id: '3',
    invoice_number: 'INV-2026-003', 
    client: 'Fintech Partners', 
    status: 'viewed' as InvoiceStatus, 
    total_amount: 1200000,
    issue_date: '2026-02-05',
    due_date: '2026-02-19',
    currency: 'NGN'
  },
  { 
    id: '4',
    invoice_number: 'INV-2026-004', 
    client: 'Lagos Consulting Group', 
    status: 'issued' as InvoiceStatus, 
    total_amount: 320000,
    issue_date: '2026-02-06',
    due_date: '2026-02-20',
    currency: 'NGN'
  },
  { 
    id: '5',
    invoice_number: 'INV-2026-005', 
    client: 'Naija Logistics', 
    status: 'paid' as InvoiceStatus, 
    total_amount: 680000,
    issue_date: '2026-02-07',
    due_date: '2026-02-21',
    currency: 'NGN'
  },
  { 
    id: '6',
    invoice_number: 'INV-2026-006', 
    client: 'Tech Hub Abuja', 
    status: 'draft' as InvoiceStatus, 
    total_amount: 275000,
    issue_date: null,
    due_date: null,
    currency: 'NGN'
  },
  { 
    id: '7',
    invoice_number: 'INV-2026-007', 
    client: 'West African Trade Co', 
    status: 'paid' as InvoiceStatus, 
    total_amount: 1500000,
    issue_date: '2026-01-28',
    due_date: '2026-02-11',
    currency: 'NGN'
  },
  { 
    id: '8',
    invoice_number: 'INV-2026-008', 
    client: 'Sunrise Manufacturing', 
    status: 'sent' as InvoiceStatus, 
    total_amount: 920000,
    issue_date: '2026-02-08',
    due_date: '2026-02-22',
    currency: 'NGN'
  },
];

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), 'MMM d, yyyy');
};

// Stats
const stats = {
  total: sampleInvoices.length,
  paid: sampleInvoices.filter(i => i.status === 'paid').length,
  outstanding: sampleInvoices.filter(i => ['sent', 'viewed', 'issued'].includes(i.status)).length,
  totalValue: sampleInvoices.reduce((sum, i) => sum + i.total_amount, 0),
};

export default function DemoInvoices() {
  return (
    <DemoLayout>
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
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <Badge className={statusColors.paid}>{stats.paid}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(sampleInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <Badge variant="outline">{stats.outstanding}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(sampleInvoices.filter(i => ['sent', 'viewed', 'issued'].includes(i.status)).reduce((sum, i) => sum + i.total_amount, 0))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  className="pl-9"
                  disabled
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
            <CardDescription>
              A list of all your invoices with their status and payment details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.invoice_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.client}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.issue_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.due_date)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total_amount, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
