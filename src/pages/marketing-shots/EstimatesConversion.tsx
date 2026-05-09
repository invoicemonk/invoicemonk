import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, FileText, X } from 'lucide-react';

const items = [
  { d: 'Brand strategy workshop (2 days)', t: 4800 },
  { d: 'Visual identity system & logo suite', t: 6200 },
  { d: 'Web design system in Figma', t: 3040 },
  { d: 'Brand guidelines document', t: 1800 },
];

export default function EstimatesConversion() {
  return (
    <MarketingShotFrame
      active="estimates"
      pageTitle="Estimate EST-2026-0048"
      pageSubtitle="Acme Studio · Accepted May 7, 2026"
      headerRight={<Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Accepted</Badge>}
    >
      <div className="relative h-full">
        {/* Dimmed underlying estimate */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <Card className="rounded-xl p-8 h-full overflow-hidden">
            <div className="grid grid-cols-12 text-xs uppercase text-muted-foreground tracking-wide pb-2 border-b">
              <div className="col-span-8">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 py-3 text-sm border-b">
                <div className="col-span-8">{it.d}</div>
                <div className="col-span-2 text-right">1</div>
                <div className="col-span-2 text-right tabular-nums">${it.t.toLocaleString()}</div>
              </div>
            ))}
          </Card>
        </div>

        {/* Modal */}
        <div className="absolute inset-0 grid place-items-center bg-foreground/30">
          <Card className="w-[640px] rounded-xl shadow-xl">
            <div className="px-6 py-5 border-b flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center"><FileText className="h-5 w-5 text-primary" /></div>
              <div className="flex-1">
                <div className="text-base font-semibold">Convert estimate to invoice</div>
                <div className="text-xs text-muted-foreground">EST-2026-0048 → New invoice for Acme Studio</div>
              </div>
              <button className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <div className="px-6 py-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Line items being copied</div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
                    <div className="h-6 w-6 rounded-full bg-primary/10 grid place-items-center"><Check className="h-3.5 w-3.5 text-primary" /></div>
                    <div className="flex-1 truncate">{it.d}</div>
                    <div className="tabular-nums font-medium">${it.t.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Invoice number</div>
                  <div className="font-mono mt-1">INV-2026-0044</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Due date</div>
                  <div className="mt-1">June 8, 2026 · Net-30</div>
                </div>
              </div>

              <div className="mt-5 flex justify-between items-center pt-4 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-xl font-semibold text-primary tabular-nums">$15,840.00</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">Cancel</Button>
                  <Button>Create invoice <ArrowRight className="h-4 w-4 ml-2" /></Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
