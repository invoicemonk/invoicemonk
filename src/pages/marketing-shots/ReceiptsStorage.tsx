import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt as ReceiptIcon, Upload, LayoutGrid } from 'lucide-react';
import { receipts, fmt } from './seed';

const categoryStyle: Record<string, string> = {
  Travel: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  Software: 'bg-primary/10 text-primary border-primary/20',
  Office: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  Equipment: 'bg-muted text-muted-foreground',
  Meals: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
};

export default function ReceiptsStorage() {
  return (
    <MarketingShotFrame
      active="receipts"
      pageTitle="Receipt library"
      pageSubtitle="247 receipts · 6 categories · all auto-tagged"
      headerRight={
        <>
          <div className="flex items-center rounded-lg border bg-card p-0.5">
            <button className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Grid</button>
            <button className="h-8 px-2.5 text-xs text-muted-foreground">List</button>
          </div>
          <Button><Upload className="h-4 w-4 mr-2" />Upload</Button>
        </>
      }
    >
      <div className="grid grid-cols-4 gap-5 h-full content-start">
        {receipts.map((r, i) => (
          <Card key={i} className="rounded-xl shadow-sm overflow-hidden">
            <div className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/40 grid place-items-center border-b relative">
              <div className="bg-card rounded-md shadow-sm w-28 px-3 py-3 font-mono text-[8px] leading-tight border">
                <div className="text-center font-bold text-[10px]">{r.vendor.toUpperCase()}</div>
                <div className="border-t border-dashed my-1.5" />
                <div className="flex justify-between"><span>Date</span><span>{r.date.slice(5)}</span></div>
                <div className="flex justify-between"><span>Items</span><span>3</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{(r.amount * 0.08).toFixed(2)}</span></div>
                <div className="border-t border-dashed my-1.5" />
                <div className="flex justify-between font-bold"><span>TOTAL</span><span>{r.amount.toFixed(2)}</span></div>
              </div>
              <Badge variant="outline" className={`absolute top-2 right-2 ${categoryStyle[r.category]}`}>{r.category}</Badge>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm truncate">{r.vendor}</div>
                <div className="text-sm font-semibold tabular-nums">{fmt(r.amount, r.currency)}</div>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{r.date}</span>
                <ReceiptIcon className="h-3.5 w-3.5" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </MarketingShotFrame>
  );
}
