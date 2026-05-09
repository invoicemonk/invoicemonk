import { MarketingShotFrame } from './MarketingShotFrame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, Save, Send, Plus } from 'lucide-react';
import { muellerInvoice as inv, fmt } from './seed';

export default function InvoicingEuVat() {
  return (
    <MarketingShotFrame
      active="invoices"
      pageTitle={`Invoice ${inv.number}`}
      pageSubtitle={`To ${inv.client.name} · Issued ${inv.issueDate} · Due ${inv.dueDate}`}
      headerRight={
        <>
          <Button variant="outline"><Save className="h-4 w-4 mr-2" />Save draft</Button>
          <Button><Send className="h-4 w-4 mr-2" />Send invoice</Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-6 h-full">
        <div className="col-span-2 space-y-5 overflow-hidden">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Bill to</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground text-xs">Client</Label>
                <div className="font-medium mt-1">{inv.client.name}</div>
                <div className="text-muted-foreground">{inv.client.contact} · {inv.client.email}</div>
                <div className="text-muted-foreground mt-1">{inv.client.address}</div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-xs">EU VAT ID</Label>
                  <Input value={inv.client.vatId} readOnly className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Currency</Label>
                  <Input value="EUR — Euro" readOnly className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line items</CardTitle>
              <Button variant="ghost" size="sm"><Plus className="h-4 w-4 mr-1" />Add line</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 px-6 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
                <div className="col-span-7">Description</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {inv.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 px-6 py-3 text-sm border-b last:border-b-0">
                  <div className="col-span-7">{it.desc}</div>
                  <div className="col-span-1 text-right">{it.qty}</div>
                  <div className="col-span-2 text-right tabular-nums">{fmt(it.unit, 'EUR')}</div>
                  <div className="col-span-2 text-right font-medium tabular-nums">{fmt(it.total, 'EUR')}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-foreground">Reverse-charge applies</div>
              <div className="text-muted-foreground">
                VAT is accounted for by the recipient under Article 196 of the EU VAT Directive (2006/112/EC). Both VAT IDs will appear on the issued PDF.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmt(inv.subtotal, 'EUR')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT (19%)</span><span className="tabular-nums">{fmt(inv.vat, 'EUR')}</span></div>
              <div className="border-t pt-3 flex justify-between text-base font-semibold"><span>Total due</span><span className="tabular-nums text-primary">{fmt(inv.total, 'EUR')}</span></div>
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">EU intra-community supply</Badge>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">VIES check</span><span className="text-primary font-medium">Validated</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Place of supply</span><span>Germany</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax point</span><span>{inv.issueDate}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
