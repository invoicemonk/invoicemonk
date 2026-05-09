import logo from '@/assets/invoicemonk-logo.png';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, MessageSquare, ShieldCheck } from 'lucide-react';

const items = [
  { d: 'Brand strategy workshop (2 days)', q: 1, u: 4800, t: 4800 },
  { d: 'Visual identity system & logo suite', q: 1, u: 6200, t: 6200 },
  { d: 'Web design system in Figma', q: 32, u: 95, t: 3040 },
  { d: 'Brand guidelines document', q: 1, u: 1800, t: 1800 },
];
const subtotal = items.reduce((s, i) => s + i.t, 0);
const total = subtotal;

export default function EstimatesClientPortal() {
  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-muted/40">
      <div className="bg-muted/30 overflow-hidden" style={{ width: 1600, height: 1200 }}>
        {/* Public top bar */}
        <div className="h-14 bg-card border-b flex items-center justify-between px-10">
          <img src={logo} alt="InvoiceMonk" className="h-7 w-auto" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Secure client portal · Acme Studio
          </div>
        </div>

        <div className="px-10 py-8 grid grid-cols-3 gap-8" style={{ height: 1200 - 56 }}>
          {/* Estimate */}
          <Card className="col-span-2 rounded-xl shadow-sm p-10 overflow-hidden">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimate</div>
                <div className="text-2xl font-semibold mt-1">EST-2026-0055</div>
                <div className="text-sm text-muted-foreground mt-1">Issued May 9, 2026 · Valid 30 days</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">Acme Studio</div>
                <div className="text-xs text-muted-foreground">548 Market St, San Francisco</div>
                <div className="text-xs text-muted-foreground">sarah@acmestudio.co</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pb-6 border-b">
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Prepared for</div>
                <div className="font-medium mt-1">Müller GmbH</div>
                <div className="text-sm text-muted-foreground">Anna Müller · a.mueller@mueller-gmbh.de</div>
                <div className="text-sm text-muted-foreground">Friedrichstraße 112, 10117 Berlin</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Project</div>
                <div className="font-medium mt-1">Brand identity & web system</div>
                <div className="text-sm text-muted-foreground">Phase 1 · Q3 2026 launch</div>
              </div>
            </div>

            <div className="py-4">
              <div className="grid grid-cols-12 text-xs uppercase text-muted-foreground tracking-wide pb-2 border-b">
                <div className="col-span-7">Description</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 py-3 text-sm border-b last:border-b-0">
                  <div className="col-span-7">{it.d}</div>
                  <div className="col-span-1 text-right">{it.q}</div>
                  <div className="col-span-2 text-right tabular-nums">${it.u.toLocaleString()}</div>
                  <div className="col-span-2 text-right tabular-nums font-medium">${it.t.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">${subtotal.toLocaleString()}</span></div>
                <div className="border-t pt-2 flex justify-between text-base font-semibold"><span>Total</span><span className="text-primary tabular-nums">${total.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Signature */}
            <div className="mt-8 pt-6 border-t">
              <div className="text-sm font-medium mb-3">Authorized signature</div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-xs text-muted-foreground">Full name</Label>
                  <Input placeholder="Type your full name" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input value="May 9, 2026" readOnly className="mt-1" />
                </div>
              </div>
              <div className="mt-3 h-20 rounded-md border-2 border-dashed border-border bg-muted/30 grid place-items-center text-xs text-muted-foreground">
                Sign here — draw or type
              </div>
            </div>
          </Card>

          {/* Action panel */}
          <div className="space-y-5">
            <Card className="rounded-xl shadow-sm p-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="text-3xl font-semibold mt-1 text-primary tabular-nums">${total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">USD · Valid until June 8, 2026</div>

              <div className="mt-6 space-y-2">
                <Button className="w-full" size="lg"><Check className="h-4 w-4 mr-2" />Accept estimate</Button>
                <Button className="w-full" size="lg" variant="outline"><MessageSquare className="h-4 w-4 mr-2" />Comment</Button>
                <Button className="w-full" size="lg" variant="ghost"><X className="h-4 w-4 mr-2" />Decline</Button>
              </div>
            </Card>

            <Card className="rounded-xl shadow-sm p-5">
              <div className="text-sm font-medium">What happens next?</div>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Acme Studio is notified instantly.</li>
                <li>An invoice is generated automatically.</li>
                <li>Project kicks off within 3 business days.</li>
              </ol>
              <Badge variant="outline" className="mt-4 border-primary/30 bg-primary/5 text-primary">
                <ShieldCheck className="h-3 w-3 mr-1" />Verified by InvoiceMonk
              </Badge>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
