import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, Mail, Eye, Download, Bell, CheckCircle2 } from 'lucide-react';
import { auditTrail, muellerInvoice } from './seed';

const iconFor = (a: string) => {
  if (a.startsWith('Created')) return FileText;
  if (a.startsWith('Sent')) return Mail;
  if (a.startsWith('Email')) return Mail;
  if (a.startsWith('Viewed')) return Eye;
  if (a.startsWith('Downloaded')) return Download;
  if (a.startsWith('Reminder')) return Bell;
  return CheckCircle2;
};

export default function FeatureRelief() {
  const i = muellerInvoice;
  return (
    <MarketingShotFrame
      active="invoices"
      pageTitle={`Invoice ${i.number}`}
      pageSubtitle={`${i.client.name} · Issued ${i.issueDate}`}
      headerRight={
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          <Shield className="h-3 w-3 mr-1" /> Immutable record
        </Badge>
      }
    >
      <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
        <Card className="col-span-8 rounded-xl p-8 overflow-hidden">
          <div className="flex items-start justify-between pb-6 border-b">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Invoice</div>
              <div className="text-2xl font-semibold mt-1">{i.number}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Issued</div>
              <div className="font-medium">{i.issueDate}</div>
              <div className="text-muted-foreground mt-2">Due</div>
              <div className="font-medium">{i.dueDate}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-6 border-b text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide mb-2">Bill to</div>
              <div className="font-semibold">{i.client.name}</div>
              <div className="text-muted-foreground">{i.client.address}</div>
              <div className="text-muted-foreground mt-1">VAT: {i.client.vatId}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide mb-2">From</div>
              <div className="font-semibold">Acme Studio</div>
              <div className="text-muted-foreground">548 Market St, Suite 220, San Francisco</div>
              <div className="text-muted-foreground mt-1">EIN: 88-1234567</div>
            </div>
          </div>

          <div className="py-4">
            <div className="grid grid-cols-12 text-xs uppercase text-muted-foreground tracking-wide pb-2 border-b">
              <div className="col-span-7">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-3 text-right">Total</div>
            </div>
            {i.items.map((it, ix) => (
              <div key={ix} className="grid grid-cols-12 py-3 text-sm border-b">
                <div className="col-span-7">{it.desc}</div>
                <div className="col-span-2 text-right">{it.qty}</div>
                <div className="col-span-3 text-right tabular-nums">€{it.total.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <div className="w-72 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">€{i.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT 19%</span><span className="tabular-nums">€{i.vat.toLocaleString()}</span></div>
              <div className="flex justify-between pt-2 border-t text-base font-semibold text-primary"><span>Total</span><span className="tabular-nums">€{i.total.toLocaleString()}</span></div>
            </div>
          </div>
        </Card>

        <Card className="col-span-4 rounded-xl p-6 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 pb-4 border-b">
            <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">Audit trail</div>
              <div className="text-xs text-muted-foreground">Tamper-evident · cryptographically signed</div>
            </div>
          </div>

          <div className="mt-4 relative flex-1 overflow-hidden">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-4">
              {auditTrail.map((e, ix) => {
                const Icon = iconFor(e.action);
                return (
                  <div key={ix} className="flex items-start gap-3 relative">
                    <div className="h-8 w-8 rounded-full border-2 border-primary bg-card grid place-items-center shrink-0 relative z-10">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="text-sm font-medium">{e.action}</div>
                      <div className="text-[11px] text-muted-foreground">{e.actor} · {e.ts}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">IP {e.ip}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 mt-4">
            <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Hash sealed
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
              sha-256: 4f8b…a92e1c · block #2048221
            </div>
          </div>
        </Card>
      </div>
    </MarketingShotFrame>
  );
}
