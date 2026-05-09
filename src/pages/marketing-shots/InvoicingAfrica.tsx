import { MarketingShotFrame } from './MarketingShotFrame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smartphone, Building2, Save, Send, Plus, Check } from 'lucide-react';
import { lagosInvoice as inv, fmt } from './seed';

export default function InvoicingAfrica() {
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
        <div className="col-span-2 space-y-5">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Bill to</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground text-xs">Client</Label>
                <div className="font-medium mt-1">{inv.client.name}</div>
                <div className="text-muted-foreground">{inv.client.contact} · {inv.client.email}</div>
                <div className="text-muted-foreground mt-1">{inv.client.address}</div>
                <div className="text-muted-foreground mt-1 font-mono text-xs">{inv.client.tin}</div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Currency</Label>
                  <Input value="NGN — Nigerian Naira" readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Withholding</Label>
                  <Input value="None — standard supply" readOnly className="mt-1" />
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
                  <div className="col-span-2 text-right tabular-nums">{fmt(it.unit, 'NGN')}</div>
                  <div className="col-span-2 text-right font-medium tabular-nums">{fmt(it.total, 'NGN')}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmt(inv.subtotal, 'NGN')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">FIRS VAT (7.5%)</span><span className="tabular-nums">{fmt(inv.vat, 'NGN')}</span></div>
              <div className="border-t pt-3 flex justify-between text-base font-semibold"><span>Total due</span><span className="tabular-nums text-primary">{fmt(inv.total, 'NGN')}</span></div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Payment options</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: 'Paystack', sub: 'Card · Bank · USSD', icon: Smartphone, on: true },
                { name: 'Flutterwave', sub: 'Card · Mobile money · Transfer', icon: Smartphone, on: true },
                { name: 'Bank transfer', sub: 'Zenith Bank · 1023 4456 78', icon: Building2, on: true },
              ].map((p) => (
                <div key={p.name} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
                    <p.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.sub}</div>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5"><Check className="h-3 w-3 mr-1" />On</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
