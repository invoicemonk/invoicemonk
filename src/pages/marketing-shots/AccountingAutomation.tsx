import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Building2, Sparkles, TrendingUp } from 'lucide-react';
import { bankFeedMatches } from './seed2';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const spark = [
  { v: 32 }, { v: 38 }, { v: 36 }, { v: 44 }, { v: 52 }, { v: 49 }, { v: 58 }, { v: 66 }, { v: 72 }, { v: 78 },
];

export default function AccountingAutomation() {
  return (
    <MarketingShotFrame
      active="reports"
      pageTitle="Bank reconciliation"
      pageSubtitle="Live bank feed · auto-matched to invoices and expenses"
      headerRight={
        <>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="h-3 w-3 mr-1" /> 98% auto-matched
          </Badge>
          <Button variant="outline"><Building2 className="h-4 w-4" /> Connected: Mercury · Stripe</Button>
        </>
      }
    >
      <div className="relative h-full">
        <Card className="rounded-xl overflow-hidden h-full flex flex-col">
          <div className="grid grid-cols-12 px-6 py-3 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
            <div className="col-span-2">Date</div>
            <div className="col-span-4">Bank description</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Match status</div>
          </div>
          <div className="flex-1 divide-y overflow-hidden">
            {bankFeedMatches.map((t, i) => (
              <div key={i} className="grid grid-cols-12 px-6 py-3 text-sm items-center">
                <div className="col-span-2 text-muted-foreground text-xs tabular-nums">{t.date}</div>
                <div className="col-span-4">
                  <div className="font-medium font-mono text-xs">{t.desc}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">→ {t.match}</div>
                </div>
                <div className={`col-span-2 text-right tabular-nums font-medium ${t.amount >= 0 ? 'text-primary' : 'text-foreground'}`}>
                  {t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className="text-[11px]">{t.matchType}</Badge>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] bg-emerald-100 text-emerald-800">
                    <Check className="h-3 w-3" /> Matched
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Showing 8 of 124 transactions this week</div>
            <div className="flex gap-6">
              <span><span className="text-muted-foreground text-xs mr-2">Inflows</span><span className="tabular-nums font-semibold text-primary">+$31,160.00</span></span>
              <span><span className="text-muted-foreground text-xs mr-2">Outflows</span><span className="tabular-nums font-semibold">−$1,539.50</span></span>
            </div>
          </div>
        </Card>

        {/* Live P&L floating card */}
        <Card className="absolute right-4 bottom-4 w-[300px] rounded-xl p-5 shadow-xl border-primary/20 bg-card/95 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Live P&L</span>
            </div>
            <Badge variant="outline" className="text-[10px]">Today</Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-semibold text-primary tabular-nums">+$78,050</div>
            <span className="text-xs text-primary flex items-center"><TrendingUp className="h-3 w-3 mr-0.5" />+17%</span>
          </div>
          <div className="text-xs text-muted-foreground">Net income · updated 4s ago</div>
          <div className="h-16 mt-2 -mx-2">
            <ResponsiveContainer>
              <LineChart data={spark}>
                <Line type="monotone" dataKey="v" stroke="hsl(170 82% 26%)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </MarketingShotFrame>
  );
}
