import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import type { ProfitabilityStats } from '@/hooks/use-cashflow-stats';

interface Props {
  data: ProfitabilityStats | undefined;
  isLoading: boolean;
  currency: string;
}

export function ProfitabilityCard({ data, isLoading, currency }: Props) {
  const margin = data?.profit_margin_pct ?? 0;
  const isProfit = (data?.net_profit ?? 0) >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PieChart className="h-5 w-5 text-primary" />
          Profitability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Revenue</p>
            {isLoading ? <Skeleton className="h-7 w-24" /> : (
              <p className="text-xl font-bold truncate" title={formatCurrency(data?.gross_revenue ?? 0, currency)}>
                {formatCompactCurrency(data?.gross_revenue ?? 0, currency)}
              </p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Expenses</p>
            {isLoading ? <Skeleton className="h-7 w-24" /> : (
              <p className="text-xl font-bold truncate" title={formatCurrency(data?.total_expenses ?? 0, currency)}>
                {formatCompactCurrency(data?.total_expenses ?? 0, currency)}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {isProfit ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
              <p className="text-sm text-muted-foreground">Net Profit</p>
            </div>
            {isLoading ? <Skeleton className="h-7 w-24" /> : (
              <>
                <p className={`text-xl font-bold truncate ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} title={formatCurrency(data?.net_profit ?? 0, currency)}>
                  {formatCompactCurrency(data?.net_profit ?? 0, currency)}
                </p>
                <p className={`text-xs ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {margin}% margin
                </p>
              </>
            )}
          </div>
        </div>

        {/* Revenue vs Expenses chart */}
        {!isLoading && data?.monthly_trend && data.monthly_trend.length > 0 && (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly_trend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString('en', { month: 'short' });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v, currency)}
                  width={70}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value, currency),
                    name === 'revenue' ? 'Revenue' : 'Expenses',
                  ]}
                  labelFormatter={(label) => {
                    const d = new Date(label);
                    return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend formatter={(value) => (value === 'revenue' ? 'Revenue' : 'Expenses')} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expense breakdown */}
        {!isLoading && data?.expense_breakdown && data.expense_breakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Top Expense Categories</p>
            <div className="space-y-1.5">
              {data.expense_breakdown.slice(0, 5).map((cat) => {
                const pct = data.total_expenses > 0 ? (cat.total / data.total_expenses) * 100 : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize truncate mr-2">{cat.category}</span>
                      <span className="text-muted-foreground shrink-0">{formatCompactCurrency(cat.total, currency)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-destructive/60 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && !data?.gross_revenue && !data?.total_expenses && (
          <p className="text-sm text-muted-foreground text-center py-4">No financial data available yet</p>
        )}
      </CardContent>
    </Card>
  );
}
