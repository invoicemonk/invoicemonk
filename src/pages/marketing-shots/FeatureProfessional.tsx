import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Send, Sparkles } from 'lucide-react';
import logo from '@/assets/invoicemonk-logo.png';
import { muellerInvoice } from './seed';

export default function FeatureProfessional() {
  const i = muellerInvoice;
  return (
    <MarketingShotFrame
      active="invoices"
      pageTitle="Invoice preview"
      pageSubtitle="Branded · compliant · ready to send"
      headerRight={
        <>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="h-3 w-3 mr-1" /> EU VAT compliant
          </Badge>
          <Button variant="outline"><Download className="h-4 w-4" /> Download PDF</Button>
          <Button><Send className="h-4 w-4" /> Send to client</Button>
        </>
      }
    >
      <div className="h-full grid place-items-start justify-center pt-2">
        <Card className="rounded-xl shadow-xl overflow-hidden bg-card" style={{ width: 880 }}>
          {/* Branded header */}
          <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-10 py-8 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src={logo} alt="InvoiceMonk" className="h-7 w-auto" />
              </div>
              <div>
                <div className="text-lg font-semibold leading-tight">Acme Studio</div>
                <div className="text-xs opacity-90">acmestudio.co</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest opacity-80">Invoice</div>
              <div className="text-3xl font-semibold mt-1 tabular-nums">{i.number}</div>
            </div>
          </div>

          <div className="px-10 py-7">
            <div className="grid grid-cols-3 gap-6 pb-6 border-b text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Bill to</div>
                <div className="font-semibold">{i.client.name}</div>
                <div className="text-muted-foreground text-xs">{i.client.contact}</div>
                <div className="text-muted-foreground text-xs mt-1">{i.client.address}</div>
                <div className="text-muted-foreground text-xs mt-1">VAT {i.client.vatId}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">From</div>
                <div className="font-semibold">Acme Studio</div>
                <div className="text-muted-foreground text-xs">548 Market St, Suite 220</div>
                <div className="text-muted-foreground text-xs">San Francisco, CA 94104</div>
                <div className="text-muted-foreground text-xs mt-1">EIN 88-1234567</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Details</div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Issued</span><span>{i.issueDate}</span>
                  <span className="text-muted-foreground">Due</span><span>{i.dueDate}</span>
                  <span className="text-muted-foreground">Terms</span><span>Net 30</span>
                  <span className="text-muted-foreground">Currency</span><span>EUR</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="grid grid-cols-12 text-[10px] uppercase tracking-wide text-muted-foreground pb-2 border-b">
                <div className="col-span-7">Description</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              {i.items.map((it, ix) => (
                <div key={ix} className="grid grid-cols-12 py-3 text-sm border-b">
                  <div className="col-span-7">{it.desc}</div>
                  <div className="col-span-1 text-right tabular-nums">{it.qty}</div>
                  <div className="col-span-2 text-right tabular-nums">€{it.unit.toLocaleString()}</div>
                  <div className="col-span-2 text-right tabular-nums">€{it.total.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-6 mt-6">
              <div className="col-span-7 text-xs">
                <div className="rounded-lg bg-muted/30 p-4">
                  <div className="font-semibold mb-1.5">Payment instructions</div>
                  <div className="grid grid-cols-2 gap-y-1 text-muted-foreground">
                    <span>Bank</span><span>Mercury · USD/EUR</span>
                    <span>IBAN</span><span className="font-mono">DE89 3704 0044 0532 0130 00</span>
                    <span>BIC/SWIFT</span><span className="font-mono">COBADEFFXXX</span>
                    <span>Reference</span><span className="font-mono">{i.number}</span>
                  </div>
                </div>
              </div>
              <div className="col-span-5">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">€{i.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT 19% (DE)</span><span className="tabular-nums">€{i.vat.toLocaleString()}</span></div>
                  <div className="flex justify-between pt-2 border-t text-lg font-semibold text-primary"><span>Total due</span><span className="tabular-nums">€{i.total.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t flex items-center justify-between text-[11px] text-muted-foreground">
              <div>Thank you for your business · payment due within 30 days</div>
              <div className="flex items-center gap-1.5">
                <img src={logo} alt="" className="h-3.5 w-auto opacity-70" />
                <span>Powered by InvoiceMonk</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MarketingShotFrame>
  );
}
