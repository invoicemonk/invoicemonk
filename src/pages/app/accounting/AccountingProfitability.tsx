import { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useProfitabilityStats } from '@/hooks/use-cashflow-stats';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--accent-foreground))',
  'hsl(210, 70%, 50%)',
  'hsl(40, 80%, 50%)',
  'hsl(160, 60%, 40%)',
  'hsl(280, 50%, 55%)',
  'hsl(330, 60%, 50%)',
];

type Period = '30d' | '90d' | '180d' | '365d' | 'ytd';

function getPeriodDates(period: Period) {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case '30d': start.setDate(end.getDate() - 30); break;
    case '90d': start.setDate(end.getDate() - 90); break;
    case '180d': start.setDate(end.getDate() - 180); break;
    case '365d': start.setFullYear(end.getFullYear() - 1); break;
    case 'ytd': start.setMonth(0, 1); break;
  }
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function AccountingProfitability() {
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount } = useCurrencyAccount();
  const currency = currentCurrencyAccount?.currency || currentBusiness?.default_currency || 'NGN';

  const [period, setPeriod] = useState<Period>('90d');
  const { start, end } = getPeriodDates(period);

  const { data, isLoading } = useProfitabilityStats(
    currentBusiness?.id,
    currentCurrencyAccount?.id,
    start,
    end,
  );

  const margin = data?.profit_margin_pct ?? 0;
  const isProfit = (data?.net_profit ?? 0) >= 0;
  const hasData = !!data?.gross_revenue || !!data?.total_expenses;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted-foreground">Revenue, expenses, and margins at a glance</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="180d">Last 6 months</SelectItem>
            <SelectItem value="365d">Last 12 months</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <AccountingNavTabs />

      {/* KPI cards */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground mb-1">Revenue</p>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <p className="text-2xl font-bold truncate" title={formatCurrency(data?.gross_revenue ?? 0, currency)}>
                {formatCompactCurrency(data?.gross_revenue ?? 0, currency)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground mb-1">Expenses</p>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <p className="text-2xl font-bold text-destructive truncate" title={formatCurrency(data?.total_expenses ?? 0, currency)}>
                {formatCompactCurrency(data?.total_expenses ?? 0, currency)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className={isProfit ? 'border-emerald-500/30' : 'border-destructive/30'}>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              {isProfit
                ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                : <TrendingDown className="h-4 w-4 text-destructive" />}
              <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
            </div>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <>
                <p className={`text-2xl font-bold truncate ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                  title={formatCurrency(data?.net_profit ?? 0, currency)}>
                  {formatCompactCurrency(data?.net_profit ?? 0, currency)}
                </p>
                <p className={`text-xs mt-0.5 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {margin}% margin
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue vs Expenses bar chart */}
      {!isLoading && data?.monthly_trend && data.monthly_trend.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Revenue vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly_trend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short' })} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v, currency)} width={70} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value, currency), name === 'revenue' ? 'Revenue' : 'Expenses']}
                      labelFormatter={(l) => new Date(l).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend formatter={(v) => (v === 'revenue' ? 'Revenue' : 'Expenses')} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Profit margin trend + Expense breakdown */}
      <motion.div variants={item} className="grid gap-4 lg:grid-cols-2">
        {!isLoading && data?.monthly_trend && data.monthly_trend.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Profit Margin Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.monthly_trend.map((m) => ({
                      ...m,
                      margin_pct: m.revenue > 0 ? Math.round(((m.revenue - m.expenses) / m.revenue) * 100) : 0,
                    }))}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short' })} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${v}%`} width={45} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Profit Margin']}
                      labelFormatter={(l) => new Date(l).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="margin_pct" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && data?.expense_breakdown && data.expense_breakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={data.expense_breakdown}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.expense_breakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value, currency), name]}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                {data.expense_breakdown.slice(0, 8).map((cat, i) => (
                  <span key={cat.category} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="capitalize">{cat.category}:</span>
                    <span className="text-muted-foreground">{formatCompactCurrency(cat.total, currency)}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Empty state */}
      {!isLoading && !hasData && (
        <motion.div variants={item}>
          <Card>
            <CardContent className="py-16 text-center">
              <PieChart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg mb-1">No financial data yet</h3>
              <p className="text-sm text-muted-foreground">Create invoices and record expenses to see your profitability analysis.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
