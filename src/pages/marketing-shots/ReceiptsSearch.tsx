import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Calendar, Building2, DollarSign, Tag, X, Upload } from 'lucide-react';
import { uberReceipts, fmt } from './seed';

const total = uberReceipts.reduce((s, r) => s + r.amount, 0);

export default function ReceiptsSearch() {
  return (
    <MarketingShotFrame
      active="receipts"
      pageTitle="Search receipts"
      pageSubtitle={`${uberReceipts.length} matches · ${fmt(total, 'USD')} total spend`}
      headerRight={<Button><Upload className="h-4 w-4 mr-2" />Upload</Button>}
    >
      <div className="space-y-4 h-full">
        <Card className="rounded-xl shadow-sm p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value="uber" readOnly className="pl-9 h-11 text-base font-medium" />
            <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground">5 results</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip icon={Calendar} label="Apr 1 – May 9, 2026" />
            <FilterChip icon={Building2} label="Vendor: Uber, Uber Eats" />
            <FilterChip icon={DollarSign} label="Amount: $10 – $100" />
            <FilterChip icon={Tag} label="Category: Travel, Meals" />
            <Button variant="ghost" size="sm" className="ml-auto h-7">Clear all</Button>
          </div>
        </Card>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-3 text-xs uppercase text-muted-foreground tracking-wide border-b bg-muted/30">
            <div className="col-span-3">Vendor</div>
            <div className="col-span-3">Date</div>
            <div className="col-span-3">Note</div>
            <div className="col-span-1">Category</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>
          {uberReceipts.map((r, i) => (
            <div key={i} className="grid grid-cols-12 px-6 py-4 text-sm border-b last:border-b-0 items-center hover:bg-muted/30">
              <div className="col-span-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center font-mono text-[10px] font-bold text-primary">{r.vendor.split(' ').map(s => s[0]).join('')}</div>
                <div className="font-medium">{r.vendor}</div>
              </div>
              <div className="col-span-3 text-muted-foreground">{r.date}</div>
              <div className="col-span-3 text-muted-foreground truncate">{r.note}</div>
              <div className="col-span-1">
                <Badge variant="outline" className={r.category === 'Travel' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'}>{r.category}</Badge>
              </div>
              <div className="col-span-2 text-right tabular-nums font-medium">{fmt(r.amount, 'USD')}</div>
            </div>
          ))}
          <div className="px-6 py-4 bg-muted/30 grid grid-cols-12 text-sm">
            <div className="col-span-10 text-right text-muted-foreground">Total of matching receipts</div>
            <div className="col-span-2 text-right font-semibold tabular-nums text-primary">{fmt(total, 'USD')}</div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Reimbursable', value: fmt(97.3, 'USD') },
            { label: 'Tax-deductible', value: fmt(139.4, 'USD') },
            { label: 'YTD on Uber', value: fmt(412.8, 'USD') },
          ].map((k) => (
            <Card key={k.label} className="rounded-xl shadow-sm p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="text-xl font-semibold mt-1 tabular-nums">{k.value}</div>
            </Card>
          ))}
        </div>
      </div>
    </MarketingShotFrame>
  );
}

function FilterChip({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Badge variant="outline" className="bg-primary/5 border-primary/30 text-primary gap-1.5 py-1 px-2.5">
      <Icon className="h-3 w-3" />{label}<X className="h-3 w-3 ml-1 opacity-60" />
    </Badge>
  );
}
