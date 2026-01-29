import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Search, 
  Eye,
  Lock,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminInvoices } from '@/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { InvoiceViewSheet } from '@/components/admin/InvoiceViewSheet';

export default function AdminInvoices() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: invoices, isLoading } = useAdminInvoices(searchQuery || undefined);

  // Sheet state
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'default', label: 'Issued' },
      sent: { variant: 'default', label: 'Sent' },
      viewed: { variant: 'outline', label: 'Viewed' },
      paid: { variant: 'default', label: 'Paid' },
      voided: { variant: 'destructive', label: 'Voided' },
      credited: { variant: 'outline', label: 'Credited' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Handler
  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setViewOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoice Inspection</h1>
        <p className="text-muted-foreground">Read-only access to all platform invoices</p>
      </div>

      {/* Critical Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Read-Only Access</p>
            <p className="text-sm text-muted-foreground">
              Platform admins can inspect but <strong>NEVER modify</strong> invoice data. 
              All issued invoices are cryptographically sealed and immutable.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number or verification ID..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Invoices
          </CardTitle>
          <CardDescription>
            {invoices?.length || 0} invoices found (limited to 200)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Integrity</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No invoices found</p>
                  </TableCell>
                </TableRow>
              ) : (
                invoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{invoice.invoice_number}</span>
                        {invoice.status !== 'draft' && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{(invoice as any).business?.name || '-'}</TableCell>
                    <TableCell>{(invoice as any).client?.name || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(invoice.total_amount), invoice.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.issued_at 
                        ? format(new Date(invoice.issued_at), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {invoice.invoice_hash ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleViewInvoice(invoice)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Verification Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Invoice Integrity Verification</p>
              <p className="text-sm text-muted-foreground">
                All issued invoices include a SHA-256 hash for tamper detection. The hash is computed 
                from the invoice ID, number, amount, client, and issuance timestamp. Any modification 
                would invalidate the hash, providing cryptographic proof of integrity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet */}
      <InvoiceViewSheet 
        invoice={selectedInvoice} 
        open={viewOpen} 
        onOpenChange={setViewOpen} 
      />
    </div>
  );
}
