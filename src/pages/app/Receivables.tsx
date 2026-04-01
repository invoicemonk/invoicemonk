import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useReceivablesIntelligence } from '@/hooks/use-cashflow-stats';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import { format, subDays, startOfYear } from 'date-fns';

const bucketConfig = [
  { key: 'current' as const, label: 'Current', color: 'bg-emerald-500', textColor: 'text-emerald-700' },
  { key: 'days_1_30' as const, label: '1–30 days', color: 'bg-amber-400', textColor: 'text-amber-700' },
  { key: 'days_31_60' as const, label: '31–60 days', color: 'bg-orange-500', textColor: 'text-orange-700' },
  { key: 'days_61_90' as const, label: '61–90 days', color: 'bg-red-400', textColor: 'text-red-600' },
  { key: 'days_90_plus' as const, label: '90+ days', color: 'bg-red-600', textColor: 'text-red-700' },
];

const periodOptions = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '180d', label: 'Last 180 days' },
  { value: '365d', label: 'Last 365 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Receivables() {
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount } = useCurrencyAccount();
  const currency = currentCurrencyAccount?.currency || currentBusiness?.default_currency || 'NGN';
  const [period, setPeriod] = useState('all');

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    switch (period) {
      case '30d': return { startDate: fmt(subDays(today, 30)), endDate: fmt(today) };
      case '90d': return { startDate: fmt(subDays(today, 90)), endDate: fmt(today) };
      case '180d': return { startDate: fmt(subDays(today, 180)), endDate: fmt(today) };
      case '365d': return { startDate: fmt(subDays(today, 365)), endDate: fmt(today) };
      case 'ytd': return { startDate: fmt(startOfYear(today)), endDate: fmt(today) };
      default: return { startDate: undefined, endDate: undefined };
    }
  }, [period]);

  const { data, isLoading } = useReceivablesIntelligence(
    currentBusiness?.id,
    currentCurrencyAccount?.id,
    startDate,
    endDate
  );

  const total = data?.total_outstanding ?? 0;
  const overdue = data?.overdue_amount ?? 0;
  const agingTotal = data?.aging
    ? Object.values(data.aging).reduce((s, v) => s + Number(v), 0)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 p-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receivables Intelligence</h1>
          <p className="text-muted-foreground">Track outstanding invoices, aging and slow-paying clients.</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Summary KPIs */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold" title={formatCurrency(total, currency)}>
              {formatCompactCurrency(total, currency)}
            </p>
          </CardContent>
        </Card>
        <Card className={overdue > 0 ? 'border-destructive/40' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1.5 mb-1">
              {overdue > 0 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            <p className={`text-2xl font-bold ${overdue > 0 ? 'text-destructive' : ''}`} title={formatCurrency(overdue, currency)}>
              {formatCompactCurrency(overdue, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Collection Rate</p>
            <p className="text-2xl font-bold">
              {total > 0 ? `${Math.round(((total - overdue) / total) * 100)}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Aging Breakdown */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Aging Breakdown
            </CardTitle>
            <CardDescription>Outstanding amounts grouped by days overdue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {agingTotal > 0 ? (
              <>
                <div className="flex h-5 rounded-full overflow-hidden">
                  {bucketConfig.map(({ key, color }) => {
                    const val = Number(data?.aging?.[key] ?? 0);
                    if (val <= 0) return null;
                    const pct = (val / agingTotal) * 100;
                    return (
                      <div
                        key={key}
                        className={`${color} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${key}: ${formatCurrency(val, currency)}`}
                      />
                    );
                  })}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bucketConfig.map(({ key, label, color }) => {
                      const val = Number(data?.aging?.[key] ?? 0);
                      const pct = agingTotal > 0 ? (val / agingTotal) * 100 : 0;
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
                              {label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(val, currency)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {pct.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(agingTotal, currency)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">No outstanding receivables</p>
                <p className="text-xs text-muted-foreground">All invoices are either fully paid or voided. Outstanding amounts will appear here when you have unpaid issued invoices.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Slow Payers */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Slowest Payers
            </CardTitle>
            <CardDescription>Clients ranked by average days to pay their invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.slow_payers && data.slow_payers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Avg Days to Pay</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slow_payers.map((payer) => (
                    <TableRow key={payer.client_id}>
                      <TableCell className="font-medium">{payer.client_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={payer.avg_days_to_pay > 60 ? 'destructive' : payer.avg_days_to_pay > 30 ? 'secondary' : 'outline'}
                        >
                          {payer.avg_days_to_pay}d
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(payer.outstanding_amount, currency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {payer.invoice_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No slow payer data available yet.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
