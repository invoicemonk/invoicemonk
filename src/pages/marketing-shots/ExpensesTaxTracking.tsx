import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Download, Receipt, FileCheck, TrendingUp } from 'lucide-react';
import { categoryColors, taxDeductibleRows } from './seed2';

const deductible = taxDeductibleRows.filter(r => r.deductible).reduce((s, r) => s + r.amount, 0);
const total = taxDeductibleRows.reduce((s, r) => s + r.amount, 0);

export default function ExpensesTaxTracking() {
  return (
    <MarketingShotFrame
      active="expenses"
      pageTitle="Tax tracking"
      pageSubtitle="Every expense flagged, sourced, and ready for filing season."
      headerRight={<Button><Download className="h-4 w-4" /> Download tax report</Button>}
    >
      <div className="space-y-5 h-full overflow-hidden">
        <div className="grid grid-cols-3 gap-4">
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileCheck className="h-4 w-4 text-primary" /> Tax-deductible YTD</div>
            <div className="text-3xl font-semibold mt-2 text-primary tabular-nums">${(deductible * 1.6).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</div>
            <div className="text-xs text-muted-foreground mt-1">across 184 expenses</div>
          </Card>
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Receipt className="h-4 w-4 text-primary" /> Receipts attached</div>
            <div className="text-3xl font-semibold mt-2 tabular-nums">100%</div>
            <div className="text-xs text-muted-foreground mt-1">184 of 184 with evidence</div>
          </Card>
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4 text-primary" /> Estimated tax savings</div>
            <div className="text-3xl font-semibold mt-2 text-primary tabular-nums">$5,840</div>
            <div className="text-xs text-muted-foreground mt-1">at 24% effective rate</div>
          </Card>
        </div>

        <Card className="rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between bg-muted/30">
            <div className="text-sm font-medium">Recent expenses</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Showing {taxDeductibleRows.length} of 184</span>
            </div>
          </div>
          <div className="grid grid-cols-12 px-5 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/10">
            <div className="col-span-3">Vendor</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-3 text-right">Tax-deductible</div>
          </div>
          <div className="divide-y">
            {taxDeductibleRows.map((r, i) => {
              const c = categoryColors[r.category];
              return (
                <div key={i} className="grid grid-cols-12 px-5 py-3 text-sm items-center">
                  <div className="col-span-3 font-medium">{r.vendor}</div>
                  <div className="col-span-2 text-muted-foreground text-xs">{r.date}</div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${c.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{r.category}
                    </span>
                  </div>
                  <div className="col-span-2 text-right tabular-nums">${r.amount.toFixed(2)}</div>
                  <div className="col-span-3 flex items-center justify-end gap-3">
                    {r.note && <span className="text-[11px] text-muted-foreground">{r.note}</span>}
                    {r.deductible ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Deductible</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Personal</Badge>
                    )}
                    <Switch checked={r.deductible} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Selected total</div>
            <div className="flex gap-6">
              <div><span className="text-muted-foreground text-xs mr-2">All</span><span className="tabular-nums font-medium">${total.toFixed(2)}</span></div>
              <div><span className="text-muted-foreground text-xs mr-2">Deductible</span><span className="tabular-nums font-semibold text-primary">${deductible.toFixed(2)}</span></div>
            </div>
          </div>
        </Card>
      </div>
    </MarketingShotFrame>
  );
}
