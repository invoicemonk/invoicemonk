import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, Phone, Globe, MapPin, Plus } from 'lucide-react';
import { acmeClient, acmeInvoices, fmt } from './seed';

const statusStyle: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  overdue: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
};

export default function ClientsProfiles() {
  return (
    <MarketingShotFrame
      active="clients"
      pageTitle={acmeClient.name}
      pageSubtitle={acmeClient.since}
      headerRight={<><Button variant="outline">Edit</Button><Button><Plus className="h-4 w-4 mr-2" />New invoice</Button></>}
    >
      <div className="grid grid-cols-3 gap-6 h-full">
        <div className="space-y-5">
          <Card className="rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14"><AvatarFallback className="bg-primary text-primary-foreground text-lg">AS</AvatarFallback></Avatar>
              <div>
                <div className="font-semibold">{acmeClient.name}</div>
                <div className="text-sm text-muted-foreground">{acmeClient.contact}</div>
              </div>
            </div>
            <div className="mt-5 space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{acmeClient.email}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{acmeClient.phone}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Globe className="h-4 w-4" />{acmeClient.website}</div>
              <div className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5" />{acmeClient.address}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {acmeClient.tags.map((t) => <Badge key={t} variant="outline" className="border-primary/30 text-primary bg-primary/5">{t}</Badge>)}
            </div>
          </Card>

          <Card className="rounded-xl shadow-sm p-6">
            <div className="text-sm font-medium mb-4">Payment behavior</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Avg. days to pay</span><span className="font-medium">11 days</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">On-time rate</span><span className="font-medium text-primary">94%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Preferred method</span><span className="font-medium">ACH</span></div>
            </div>
          </Card>
        </div>

        <div className="col-span-2 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Lifetime value', value: fmt(48200, 'USD') },
              { label: 'Outstanding', value: fmt(3450, 'USD'), accent: true },
              { label: 'Invoices', value: '27' },
            ].map((k) => (
              <Card key={k.label} className="rounded-xl shadow-sm p-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <div className={`text-2xl font-semibold mt-2 tabular-nums ${k.accent ? 'text-primary' : ''}`}>{k.value}</div>
              </Card>
            ))}
          </div>

          <Card className="rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="font-medium">Recent invoices</div>
              <Button variant="ghost" size="sm">View all</Button>
            </div>
            <div className="grid grid-cols-12 px-6 py-2 text-xs uppercase text-muted-foreground tracking-wide border-b bg-muted/30">
              <div className="col-span-3">Number</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-3 text-right">Amount</div>
              <div className="col-span-3 text-right">Status</div>
            </div>
            {acmeInvoices.map((r) => (
              <div key={r.number} className="grid grid-cols-12 px-6 py-4 text-sm border-b last:border-b-0 items-center">
                <div className="col-span-3 font-mono text-xs">{r.number}</div>
                <div className="col-span-3 text-muted-foreground">{r.date}</div>
                <div className="col-span-3 text-right tabular-nums font-medium">{fmt(r.amount, 'USD')}</div>
                <div className="col-span-3 text-right"><Badge variant="outline" className={statusStyle[r.status]}>{r.status}</Badge></div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
