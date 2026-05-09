import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Send, Eye, Bell, CreditCard, Heart, MessageSquare, FileText } from 'lucide-react';

const events = [
  { icon: Send, color: 'text-primary bg-primary/10', title: 'Invoice INV-2026-0041 sent', meta: 'May 6, 2026 · 09:14 · via email to sarah@acmestudio.co', body: 'Subject: Invoice INV-2026-0041 from Acme Studio — $9,450.00 due May 20.' },
  { icon: Eye, color: 'text-blue-700 bg-blue-500/10', title: 'Invoice viewed by client', meta: 'May 6, 2026 · 14:42 · opened from desktop (San Francisco)', body: 'Sarah Chen opened the invoice and downloaded the PDF.' },
  { icon: Bell, color: 'text-amber-700 bg-amber-500/10', title: 'Friendly reminder sent', meta: 'May 18, 2026 · 08:00 · automated · 2 days before due', body: 'Reminder template "Polite nudge" delivered. Tracking link active.' },
  { icon: CreditCard, color: 'text-primary bg-primary/10', title: 'Partial payment received', meta: 'May 19, 2026 · 11:27 · ACH transfer · $5,000.00', body: 'Allocated to INV-2026-0041. Remaining balance $4,450.00.' },
  { icon: MessageSquare, color: 'text-foreground bg-muted', title: 'Comment from client', meta: 'May 19, 2026 · 15:03 · Sarah Chen', body: '"Sending the rest by Friday — thanks for the patience!"' },
  { icon: Heart, color: 'text-primary bg-primary/10', title: 'Thank-you note sent', meta: 'May 22, 2026 · 09:00 · automated on full payment', body: 'Closing message delivered. Invoice marked paid in full.' },
];

export default function ClientsCommunication() {
  return (
    <MarketingShotFrame
      active="clients"
      pageTitle="Acme Studio · Activity"
      pageSubtitle="Every email, view, payment and note in one timeline"
      headerRight={<><Button variant="outline"><FileText className="h-4 w-4 mr-2" />Export log</Button><Button>Compose message</Button></>}
    >
      <div className="grid grid-cols-3 gap-6 h-full">
        <Card className="col-span-2 rounded-xl shadow-sm p-8 overflow-hidden">
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-6">
              {events.map((e, i) => {
                const Icon = e.icon;
                return (
                  <div key={i} className="relative pl-12">
                    <div className={`absolute left-0 top-0 h-10 w-10 rounded-full grid place-items-center ${e.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="font-medium text-sm">{e.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{e.meta}</div>
                    <div className="mt-2 rounded-lg bg-muted/50 border px-3 py-2 text-sm text-foreground/80">{e.body}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-xl shadow-sm p-5">
            <div className="text-sm font-medium">Communication summary</div>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Emails sent" value="14" />
              <Row label="Open rate" value="92%" />
              <Row label="Avg. response time" value="6h 12m" />
              <Row label="Last contact" value="May 22, 2026" />
            </div>
          </Card>

          <Card className="rounded-xl shadow-sm p-5">
            <div className="text-sm font-medium">Active automations</div>
            <div className="mt-4 space-y-2">
              {['Polite nudge — 2 days before due', 'Overdue follow-up — day +3', 'Thank-you on full payment'].map((a) => (
                <div key={a} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="flex-1">{a}</span>
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">On</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div>;
}
