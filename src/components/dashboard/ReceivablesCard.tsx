import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Users } from 'lucide-react';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import type { ReceivablesIntelligence } from '@/hooks/use-cashflow-stats';

interface Props {
  data: ReceivablesIntelligence | undefined;
  isLoading: boolean;
  currency: string;
}

const bucketLabels = [
  { key: 'current' as const, label: 'Current', color: 'bg-emerald-500' },
  { key: 'days_1_30' as const, label: '1–30 days', color: 'bg-amber-400' },
  { key: 'days_31_60' as const, label: '31–60 days', color: 'bg-orange-500' },
  { key: 'days_61_90' as const, label: '61–90 days', color: 'bg-red-400' },
  { key: 'days_90_plus' as const, label: '90+ days', color: 'bg-red-600' },
];

export function ReceivablesCard({ data, isLoading, currency }: Props) {
  const total = data?.total_outstanding ?? 0;
  const overdue = data?.overdue_amount ?? 0;

  // Calculate aging bar widths
  const agingTotal = data?.aging
    ? Object.values(data.aging).reduce((s, v) => s + Number(v), 0)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Receivables
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
            {isLoading ? <Skeleton className="h-7 w-28" /> : (
              <p className="text-xl font-bold truncate" title={formatCurrency(total, currency)}>
                {formatCompactCurrency(total, currency)}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${overdue > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {overdue > 0 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            {isLoading ? <Skeleton className="h-7 w-28" /> : (
              <p className={`text-xl font-bold truncate ${overdue > 0 ? 'text-destructive' : ''}`} title={formatCurrency(overdue, currency)}>
                {formatCompactCurrency(overdue, currency)}
              </p>
            )}
          </div>
        </div>

        {/* Aging bar */}
        {!isLoading && agingTotal > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Aging Breakdown</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              {bucketLabels.map(({ key, color }) => {
                const val = Number(data?.aging?.[key] ?? 0);
                if (val <= 0) return null;
                const pct = (val / agingTotal) * 100;
                return <div key={key} className={`${color}`} style={{ width: `${pct}%` }} />;
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {bucketLabels.map(({ key, label, color }) => {
                const val = Number(data?.aging?.[key] ?? 0);
                if (val <= 0) return null;
                return (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                    {label}: {formatCompactCurrency(val, currency)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Slow payers */}
        {!isLoading && data?.slow_payers && data.slow_payers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Slowest Payers
            </p>
            <div className="space-y-2">
              {data.slow_payers.slice(0, 5).map((p) => (
                <div key={p.client_id} className="flex items-center justify-between text-sm">
                  <span className="truncate mr-2">{p.client_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">{p.avg_days_to_pay}d avg</Badge>
                    <span className="text-muted-foreground">{formatCompactCurrency(p.outstanding_amount, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No outstanding receivables</p>
        )}
      </CardContent>
    </Card>
  );
}
