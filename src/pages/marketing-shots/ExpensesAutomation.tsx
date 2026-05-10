import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText, Wand2, ArrowRight, Check } from 'lucide-react';
import { automationFeed, categoryColors } from './seed2';

export default function ExpensesAutomation() {
  return (
    <MarketingShotFrame
      active="expenses"
      pageTitle="Expense automation"
      pageSubtitle="Receipts in, categorized expenses out — without a spreadsheet."
      headerRight={
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          <Sparkles className="h-3 w-3 mr-1" /> 184 receipts processed this month
        </Badge>
      }
    >
      <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
        {/* Parsing */}
        <Card className="col-span-5 rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Wand2 className="h-4 w-4 text-primary" /> Step 1 · Parsing receipt
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 flex-1">
            <div className="rounded-lg bg-gradient-to-b from-amber-50 to-amber-100/60 border p-3 text-[10px] font-mono leading-relaxed shadow-inner">
              <div className="text-center font-bold text-xs mb-1">LUFTHANSA</div>
              <div className="text-center text-[9px] mb-2">Booking ref: KL8821</div>
              <div className="border-t border-dashed border-foreground/30 my-1" />
              <div>Date: 03 May 2026</div>
              <div>Pax: S. Chen</div>
              <div>Route: SFO → BER</div>
              <div className="border-t border-dashed border-foreground/30 my-1" />
              <div className="flex justify-between"><span>Fare</span><span>€548.00</span></div>
              <div className="flex justify-between"><span>Tax</span><span>€64.40</span></div>
              <div className="border-t border-dashed border-foreground/30 my-1" />
              <div className="flex justify-between font-bold"><span>Total</span><span>€612.40</span></div>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { k: 'Vendor', v: 'Lufthansa', c: 99 },
                { k: 'Date', v: 'May 3, 2026', c: 99 },
                { k: 'Amount', v: '€612.40', c: 98 },
                { k: 'Category', v: 'Travel', c: 95 },
                { k: 'Tax', v: '€64.40 (VAT)', c: 92 },
              ].map(f => (
                <div key={f.k} className="rounded-md border bg-background px-2.5 py-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[10px] uppercase">{f.k}</span>
                    <span className="text-[10px] text-primary">{f.c}%</span>
                  </div>
                  <div className="font-medium mt-0.5">{f.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-primary text-sm mt-3 pt-3 border-t">
            <Check className="h-4 w-4" /> Extracted in 1.4s
          </div>
        </Card>

        {/* Already categorized list */}
        <Card className="col-span-4 rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <FileText className="h-4 w-4 text-primary" /> Step 2 · Auto-categorized
          </div>
          <div className="mt-3 space-y-2 flex-1 overflow-hidden">
            {automationFeed.map((e, i) => {
              const c = categoryColors[e.category];
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
                  <div className={`h-8 w-8 rounded-md grid place-items-center text-xs font-semibold ${c.pill}`}>
                    {e.vendor.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{e.vendor}</div>
                    <div className="text-[11px] text-muted-foreground">{e.date} · {e.source}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${c.pill} border-0`}>{e.category}</Badge>
                  <div className="tabular-nums text-sm font-medium w-20 text-right">${e.amount.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground pt-3 border-t mt-3">
            5 of 184 expenses · all matched to vendor & category
          </div>
        </Card>

        {/* Generate report */}
        <Card className="col-span-3 rounded-xl p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 flex flex-col">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
            <ArrowRight className="h-4 w-4" /> Step 3 · Report
          </div>
          <div className="mt-3 text-sm font-semibold">Monthly expense report</div>
          <div className="text-xs text-muted-foreground mt-1">May 1 – May 9, 2026</div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Receipts processed</span><span className="font-medium tabular-nums">184</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Auto-categorized</span><span className="font-medium tabular-nums text-primary">181</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Needs review</span><span className="font-medium tabular-nums">3</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total spend</span><span className="font-semibold tabular-nums">$12,840</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax-deductible</span><span className="font-semibold tabular-nums text-primary">$11,624</span></div>
          </div>

          <div className="mt-auto pt-5 space-y-2">
            <Button className="w-full">Generate report <ArrowRight className="h-4 w-4 ml-1" /></Button>
            <div className="text-[11px] text-muted-foreground text-center">PDF · CSV · Quickbooks export</div>
          </div>
        </Card>
      </div>
    </MarketingShotFrame>
  );
}
