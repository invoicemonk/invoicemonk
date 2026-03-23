import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import type { CashflowSummary } from '@/hooks/use-cashflow-stats';

interface Props {
  data: CashflowSummary | undefined;
  isLoading: boolean;
  currency: string;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const isPositive = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{pct}%
    </span>
  );
}

export function CashflowSummaryCard({ data, isLoading, currency }: Props) {
  const net = data?.net_cashflow ?? 0;
  const isPositiveNet = net >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-primary" />
          Cash Flow
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Inflow */}
          <div className="p-4 rounded-lg bg-emerald-500/10">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-muted-foreground">Money In</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate" title={formatCurrency(data?.inflow ?? 0, currency)}>
                  {formatCompactCurrency(data?.inflow ?? 0, currency)}
                </p>
                <ChangeBadge pct={data?.inflow_change_pct ?? null} />
              </>
            )}
          </div>

          {/* Outflow */}
          <div className="p-4 rounded-lg bg-red-500/10">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-muted-foreground">Money Out</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <>
                <p className="text-xl font-bold text-red-600 dark:text-red-400 truncate" title={formatCurrency(data?.outflow ?? 0, currency)}>
                  {formatCompactCurrency(data?.outflow ?? 0, currency)}
                </p>
                <ChangeBadge pct={data?.outflow_change_pct ?? null} />
              </>
            )}
          </div>

          {/* Net */}
          <div className={`p-4 rounded-lg ${isPositiveNet ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className={`h-4 w-4 ${isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
              <span className="text-sm font-medium text-muted-foreground">Net Cash Flow</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <>
                <p className={`text-xl font-bold truncate ${isPositiveNet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} title={formatCurrency(net, currency)}>
                  {formatCompactCurrency(net, currency)}
                </p>
                <ChangeBadge pct={data?.net_change_pct ?? null} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
