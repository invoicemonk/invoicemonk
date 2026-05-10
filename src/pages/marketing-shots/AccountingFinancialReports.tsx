import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, ArrowUpRight } from 'lucide-react';
import { plReport } from './seed2';
import { cn } from '@/lib/utils';

const fmt = (n?: number) => (n == null ? '' : '$' + n.toLocaleString('en-US'));
const pct = (a?: number, b?: number) => (a == null || b == null || b === 0) ? '' : (((a - b) / b) * 100);

export default function AccountingFinancialReports() {
  return (
    <MarketingShotFrame
      active="reports"
      pageTitle="Profit & Loss"
      pageSubtitle={plReport.period}
      headerRight={
        <>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <FileText className="h-3 w-3 mr-1" /> Comparative · prior period
          </Badge>
          <Button variant="outline"><Download className="h-4 w-4" /> Export PDF</Button>
          <Button><Download className="h-4 w-4" /> Export CSV</Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
        <Card className="col-span-9 rounded-xl overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 px-6 py-3 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
            <div className="col-span-5">Line</div>
            <div className="col-span-2 text-right">Current</div>
            <div className="col-span-2 text-right">Prior</div>
            <div className="col-span-3 text-right">Change</div>
          </div>
          <div className="flex-1 overflow-hidden divide-y">
            {plReport.rows.map((r, i) => {
              const change = pct(r.current, r.prior);
              if (r.kind === 'header') {
                return (
                  <div key={i} className="px-6 py-2.5 bg-muted/20">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">{r.label}</span>
                  </div>
                );
              }
              const isTotal = r.kind === 'total';
              return (
                <div
                  key={i}
                  className={cn(
                    'grid grid-cols-12 px-6 py-2.5 text-sm items-center',
                    isTotal && 'bg-muted/10 font-semibold',
                    r.emphasize && 'bg-primary/5 text-primary',
                  )}
                >
                  <div className={cn('col-span-5', !isTotal && 'pl-4')}>{r.label}</div>
                  <div className="col-span-2 text-right tabular-nums">{fmt(r.current)}</div>
                  <div className="col-span-2 text-right tabular-nums text-muted-foreground">{fmt(r.prior)}</div>
                  <div className="col-span-3 text-right tabular-nums">
                    {typeof change === 'number' && (
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium',
                        change >= 0 ? 'text-primary' : 'text-amber-700',
                      )}>
                        <ArrowUpRight className={cn('h-3 w-3', change < 0 && 'rotate-180')} />
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="col-span-3 space-y-4">
          <Card className="rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Net income</div>
            <div className="text-3xl font-semibold mt-2 text-primary tabular-nums">$78,050</div>
            <div className="text-xs text-primary mt-1">+17.0% vs prior period</div>
          </Card>
          <Card className="rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Gross margin</div>
            <div className="text-3xl font-semibold mt-2 tabular-nums">77.5%</div>
            <div className="text-xs text-muted-foreground mt-1">+0.4pp vs prior</div>
          </Card>
          <Card className="rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Operating ratio</div>
            <div className="text-3xl font-semibold mt-2 tabular-nums">40.9%</div>
            <div className="text-xs text-muted-foreground mt-1">opex / revenue</div>
          </Card>
          <Card className="rounded-xl p-5 bg-primary/5 border-primary/20">
            <div className="text-xs font-semibold text-primary">Audit ready</div>
            <div className="text-xs text-muted-foreground mt-1">
              Every line traces to a source document. Click any number to drill down.
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
