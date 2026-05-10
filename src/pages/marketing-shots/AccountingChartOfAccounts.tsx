import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Download, BookOpen } from 'lucide-react';
import { chartOfAccounts } from './seed2';

const fmt = (n: number) => '$' + n.toLocaleString('en-US');

export default function AccountingChartOfAccounts() {
  return (
    <MarketingShotFrame
      active="reports"
      pageTitle="Chart of accounts"
      pageSubtitle="Standard accounting structure · YTD 2026"
      headerRight={
        <>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <BookOpen className="h-3 w-3 mr-1" /> 38 accounts
          </Badge>
          <Button variant="outline"><Download className="h-4 w-4" /> Export</Button>
        </>
      }
    >
      <Card className="rounded-xl overflow-hidden h-full flex flex-col">
        <div className="grid grid-cols-12 px-6 py-3 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
          <div className="col-span-2">Code</div>
          <div className="col-span-7">Account</div>
          <div className="col-span-3 text-right">YTD balance</div>
        </div>

        <div className="flex-1 overflow-hidden divide-y">
          {chartOfAccounts.map((g) => (
            <div key={g.group}>
              <div className="grid grid-cols-12 px-6 py-3 bg-muted/20 items-center">
                <div className="col-span-9 flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">{g.group}</span>
                  <Badge variant="outline" className="text-[10px]">{g.items.length}</Badge>
                </div>
                <div className="col-span-3 text-right tabular-nums font-semibold">{fmt(g.total)}</div>
              </div>
              {g.items.map((a) => (
                <div key={a.code} className="grid grid-cols-12 px-6 py-2.5 text-sm items-center hover:bg-muted/20">
                  <div className="col-span-2 font-mono text-xs text-muted-foreground">{a.code}</div>
                  <div className="col-span-7 pl-6">{a.name}</div>
                  <div className="col-span-3 text-right tabular-nums">{fmt(a.balance)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 px-6 py-3 border-t bg-muted/30 items-center">
          <div className="col-span-9 text-sm font-semibold">Net position</div>
          <div className="col-span-3 text-right text-base font-semibold text-primary tabular-nums">$184,250</div>
        </div>
      </Card>
    </MarketingShotFrame>
  );
}
