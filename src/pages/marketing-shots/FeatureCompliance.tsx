import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, FileCheck, Globe, Download, CheckCircle2 } from 'lucide-react';
import { jurisdictions } from './seed2';

const totalRecords = jurisdictions.reduce((s, j) => s + j.records, 0);

export default function FeatureCompliance() {
  return (
    <MarketingShotFrame
      active="settings"
      pageTitle="Compliance dashboard"
      pageSubtitle="Multi-jurisdiction status · audit-ready at all times"
      headerRight={
        <>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <ShieldCheck className="h-3 w-3 mr-1" /> All jurisdictions compliant
          </Badge>
          <Button variant="outline"><Download className="h-4 w-4" /> Export audit pack</Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
        <div className="col-span-8 space-y-3 overflow-hidden">
          <Card className="rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Jurisdictions
              </div>
              <span className="text-xs text-muted-foreground">{jurisdictions.length} active</span>
            </div>
            <div className="divide-y">
              {jurisdictions.map((j) => (
                <div key={j.code} className="grid grid-cols-12 px-5 py-4 items-center">
                  <div className="col-span-1">
                    <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center font-mono text-xs font-semibold text-primary">
                      {j.code}
                    </div>
                  </div>
                  <div className="col-span-5">
                    <div className="text-sm font-medium">{j.name}</div>
                    <div className="text-[11px] text-muted-foreground">{j.framework}</div>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    <div className="text-[10px] uppercase">Last check</div>
                    <div>{j.last}</div>
                  </div>
                  <div className="col-span-2 text-xs">
                    <div className="text-[10px] uppercase text-muted-foreground">Records</div>
                    <div className="font-medium tabular-nums">{j.records}</div>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-emerald-100 text-emerald-800 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Compliant
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-4 space-y-4">
          <Card className="rounded-xl p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-semibold">
              <FileCheck className="h-4 w-4" /> Audit-ready records
            </div>
            <div className="text-4xl font-semibold mt-3 text-primary tabular-nums">{totalRecords.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">across {jurisdictions.length} jurisdictions · all signed</div>
          </Card>

          <Card className="rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Compliance score</div>
            <div className="text-3xl font-semibold mt-2 tabular-nums">100%</div>
            <div className="h-2 mt-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '100%' }} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">No open issues · no pending filings</div>
          </Card>

          <Card className="rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Recent activity</div>
            <div className="space-y-2.5 text-xs">
              {[
                { t: 'EU VAT submission accepted', s: '2 hours ago' },
                { t: 'GST invoice e-signed', s: '5 hours ago' },
                { t: 'FIRS records archived', s: 'Yesterday' },
                { t: 'HMRC quarterly snapshot', s: '3 days ago' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div>{a.t}</div>
                    <div className="text-muted-foreground text-[10px]">{a.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
