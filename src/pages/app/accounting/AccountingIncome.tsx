import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { TrendingUp, FileText, Eye, ArrowRight, CheckCircle } from 'lucide-react';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccountingPreferences, AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useAccountingStats } from '@/hooks/use-accounting-stats';
import { useInvoices } from '@/hooks/use-invoices';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  issued: { label: 'Issued', variant: 'default' },
  sent: { label: 'Sent', variant: 'default' },
  viewed: { label: 'Viewed', variant: 'outline' },
  paid: { label: 'Paid', variant: 'default' },
  voided: { label: 'Voided', variant: 'destructive' },
  credited: { label: 'Credited', variant: 'destructive' },
};

export default function AccountingIncome() {
  const { data: preferences } = useAccountingPreferences();
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'monthly');
  
  const dateRange = getAccountingDateRange(period);
  const { data: stats, isLoading: isLoadingStats } = useAccountingStats(dateRange);
  const { data: invoices, isLoading: isLoadingInvoices } = useInvoices();

  // Filter invoices by period and non-draft status
  const filteredInvoices = (invoices || []).filter(inv => {
    if (inv.status === 'draft') return false;
    if (!inv.issued_at) return false;
    const issuedDate = new Date(inv.issued_at);
    return issuedDate >= dateRange.start && issuedDate <= dateRange.end;
  }).slice(0, 10);

  const isLoading = isLoadingStats || isLoadingInvoices;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <AccountingNavTabs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Money In</h1>
          <p className="text-muted-foreground mt-1">
            Revenue from invoices in {getPeriodLabel(period)}
          </p>
        </div>
        <AccountingPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Stats cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyFlowCard
            title="Total Revenue"
            amount={stats?.revenue || 0}
            currency={stats?.currency || 'NGN'}
            count={stats?.revenueCount}
            countLabel="invoices"
            icon={FileText}
            variant="default"
          />
          <MoneyFlowCard
            title="Money In (Paid)"
            amount={stats?.moneyIn || 0}
            currency={stats?.currency || 'NGN'}
            count={stats?.moneyInCount}
            countLabel="paid"
            icon={CheckCircle}
            variant="success"
          />
          <MoneyFlowCard
            title="Outstanding"
            amount={stats?.outstanding || 0}
            currency={stats?.currency || 'NGN'}
            count={stats?.outstandingCount}
            countLabel="unpaid"
            icon={Eye}
            variant="warning"
          />
        </div>
      )}

      {/* Invoices list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Invoices issued in {getPeriodLabel(period)}</CardDescription>
          </div>
          <Link to="/invoices">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoadingInvoices ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No invoices issued in this period.</p>
              <Link to="/invoices/new">
                <Button className="mt-4">Create Invoice</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link 
                        to={`/invoices/${invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.clients?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      {invoice.issue_date 
                        ? format(new Date(invoice.issue_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[invoice.status]?.variant || 'secondary'}>
                        {statusConfig[invoice.status]?.label || invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(invoice.total_amount), invoice.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AccountingDisclaimer type="income" />
    </motion.div>
  );
}
