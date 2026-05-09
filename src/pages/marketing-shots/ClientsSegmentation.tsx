import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, Search, X, Plus } from 'lucide-react';
import { segmentedClients, fmt } from './seed';

const tagStyle: Record<string, string> = {
  'Top 10%': 'bg-primary/10 text-primary border-primary/20',
  'Retainer': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'Net-15': 'bg-muted text-muted-foreground',
  'Net-30': 'bg-muted text-muted-foreground',
  'EU VAT': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'Construction': 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  'Design': 'bg-muted text-muted-foreground',
  'Overdue 30+': 'bg-amber-500/15 text-amber-800 border-amber-500/30',
  'New': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
};

export default function ClientsSegmentation() {
  return (
    <MarketingShotFrame
      active="clients"
      pageTitle="Clients"
      pageSubtitle="Segment by revenue, status, tags or payment behavior"
      headerRight={<Button><Plus className="h-4 w-4 mr-2" />Add client</Button>}
    >
      <div className="space-y-4 h-full">
        <Card className="rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients…" className="pl-9 h-9" />
            </div>
            <span className="text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5 inline mr-1" />Active filters:</span>
            {['Top 10% by revenue', 'Overdue > 30 days', 'Retainer'].map((f) => (
              <Badge key={f} variant="outline" className="bg-primary/5 text-primary border-primary/30 gap-1">
                {f}<X className="h-3 w-3" />
              </Badge>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto">Save view</Button>
          </div>
        </Card>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-3 text-xs uppercase text-muted-foreground tracking-wide border-b bg-muted/30">
            <div className="col-span-3">Client</div>
            <div className="col-span-4">Tags</div>
            <div className="col-span-2 text-right">Lifetime revenue</div>
            <div className="col-span-2 text-right">Outstanding</div>
            <div className="col-span-1 text-right">Last invoice</div>
          </div>
          {segmentedClients.map((c) => (
            <div key={c.name} className="grid grid-cols-12 px-6 py-4 text-sm border-b last:border-b-0 items-center hover:bg-muted/30">
              <div className="col-span-3">
                <div className="font-medium">{c.name}</div>
              </div>
              <div className="col-span-4 flex flex-wrap gap-1.5">
                {c.tags.map((t) => <Badge key={t} variant="outline" className={tagStyle[t] || 'bg-muted text-muted-foreground'}>{t}</Badge>)}
              </div>
              <div className="col-span-2 text-right tabular-nums font-medium">{fmt(c.revenue, 'USD')}</div>
              <div className={`col-span-2 text-right tabular-nums ${c.outstanding > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{fmt(c.outstanding, 'USD')}</div>
              <div className="col-span-1 text-right text-xs text-muted-foreground">{c.lastInvoice}</div>
            </div>
          ))}
        </Card>

        <div className="text-xs text-muted-foreground">Showing {segmentedClients.length} of 184 clients matching current filters.</div>
      </div>
    </MarketingShotFrame>
  );
}
