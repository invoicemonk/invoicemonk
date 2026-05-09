import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { estimatesByStatus, fmt } from './seed';

const columnAccent: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Sent: 'bg-amber-500/10 text-amber-700',
  Viewed: 'bg-blue-500/10 text-blue-700',
  Accepted: 'bg-primary/10 text-primary',
  Declined: 'bg-muted text-muted-foreground',
};

export default function EstimatesTracking() {
  return (
    <MarketingShotFrame
      active="estimates"
      pageTitle="Estimates pipeline"
      pageSubtitle="Track every estimate from draft to acceptance"
      headerRight={
        <>
          <div className="flex items-center rounded-lg border bg-card p-0.5">
            <button className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Board</button>
            <button className="h-8 px-2.5 text-xs text-muted-foreground flex items-center gap-1.5"><List className="h-3.5 w-3.5" />List</button>
          </div>
          <Button><Plus className="h-4 w-4 mr-2" />New estimate</Button>
        </>
      }
    >
      <div className="grid grid-cols-5 gap-4 h-full">
        {(Object.keys(estimatesByStatus) as Array<keyof typeof estimatesByStatus>).map((col) => {
          const items = estimatesByStatus[col];
          const total = items.reduce((s, i) => s + (i.currency === 'USD' ? i.total : i.currency === 'EUR' ? i.total * 1.08 : i.currency === 'NGN' ? i.total / 1535 : i.total / 130), 0);
          return (
            <div key={col} className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={columnAccent[col]}>{col}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">≈ {fmt(total, 'USD')}</span>
              </div>
              <div className="flex-1 rounded-xl bg-muted/40 p-3 space-y-3 overflow-hidden border">
                {items.map((e) => (
                  <Card key={e.id} className="rounded-lg p-3 shadow-sm">
                    <div className="font-mono text-[11px] text-muted-foreground">{e.id}</div>
                    <div className="font-medium text-sm mt-1 truncate">{e.client}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-[10px]">{e.currency}</Badge>
                      <span className="text-sm font-semibold tabular-nums">{fmt(e.total, e.currency)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </MarketingShotFrame>
  );
}
