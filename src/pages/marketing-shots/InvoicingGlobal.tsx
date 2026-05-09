import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, Download, Plus } from 'lucide-react';
import { globalInvoices, fmt } from './seed';

const statusStyle: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  sent: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  viewed: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  overdue: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
};

export default function InvoicingGlobal() {
  return (
    <MarketingShotFrame
      active="invoices"
      pageTitle="Invoices"
      pageSubtitle="All currencies · converted to USD (base) at today's mid-market rate"
      headerRight={
        <>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button><Plus className="h-4 w-4 mr-2" />New invoice</Button>
        </>
      }
    >
      <div className="space-y-4 h-full">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary"><Filter className="h-3 w-3 mr-1" />All currencies</Badge>
          <Badge variant="outline">USD</Badge>
          <Badge variant="outline">EUR</Badge>
          <Badge variant="outline">NGN</Badge>
          <Badge variant="outline">KES</Badge>
          <span className="text-xs text-muted-foreground ml-2">Showing {globalInvoices.length} of 187 invoices</span>
        </div>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
            <div className="col-span-2">Number</div>
            <div className="col-span-3">Client</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-1">Currency</div>
            <div className="col-span-2 text-right">Total (native)</div>
            <div className="col-span-1 text-right">≈ USD</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          {globalInvoices.map((row) => (
            <div key={row.number} className="grid grid-cols-12 px-6 py-4 text-sm border-b last:border-b-0 items-center hover:bg-muted/30">
              <div className="col-span-2 font-mono text-xs">{row.number}</div>
              <div className="col-span-3 font-medium">{row.client}</div>
              <div className="col-span-2 text-muted-foreground">{row.date}</div>
              <div className="col-span-1"><Badge variant="outline" className="font-mono text-[10px]">{row.currency}</Badge></div>
              <div className="col-span-2 text-right tabular-nums font-medium">{fmt(row.total, row.currency)}</div>
              <div className="col-span-1 text-right tabular-nums text-muted-foreground text-xs">≈ {fmt(row.usd, 'USD')}</div>
              <div className="col-span-1 text-right">
                <Badge variant="outline" className={statusStyle[row.status]}>{row.status}</Badge>
              </div>
            </div>
          ))}
        </Card>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Outstanding (USD eq.)', value: fmt(28395, 'USD') },
            { label: 'Paid this month', value: fmt(43130, 'USD') },
            { label: 'Average invoice', value: fmt(5180, 'USD') },
            { label: 'FX gain (MTD)', value: '+ ' + fmt(412, 'USD') },
          ].map((k) => (
            <Card key={k.label} className="rounded-xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-semibold mt-2 tabular-nums">{k.value}</div>
            </Card>
          ))}
        </div>
      </div>
    </MarketingShotFrame>
  );
}
