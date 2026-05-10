import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Check, Plus, ChevronDown } from 'lucide-react';
import { entities } from './seed2';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const consolidated = entities.reduce((s, e) => s + e.revenue, 0);
const monthly = [
  { m: 'Jan', Acme: 28000, Müller: 22000, Lagos: 14000 },
  { m: 'Feb', Acme: 32000, Müller: 24000, Lagos: 16000 },
  { m: 'Mar', Acme: 34000, Müller: 26800, Lagos: 17400 },
  { m: 'Apr', Acme: 42000, Müller: 30000, Lagos: 22000 },
  { m: 'May', Acme: 50400, Müller: 40000, Lagos: 27000 },
];

export default function AccountingMultiEntity() {
  return (
    <MarketingShotFrame
      active="dashboard"
      pageTitle="Consolidated dashboard"
      pageSubtitle="All entities, one source of truth"
      headerRight={
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          <Building2 className="h-3 w-3 mr-1" /> 3 active entities
        </Badge>
      }
    >
      <div className="relative h-full">
        {/* Open entity dropdown overlay */}
        <div className="absolute left-0 top-0 z-20 w-[340px]">
          <div className="rounded-lg border bg-card shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center justify-between text-sm">
              <span className="font-medium">Switch entity</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-1.5">
              {entities.map((e, i) => (
                <div
                  key={e.name}
                  className={`flex items-center gap-3 rounded-md px-2.5 py-2 ${i === 0 ? 'bg-primary/10' : 'hover:bg-accent'}`}
                >
                  <div className={`h-8 w-8 rounded-md grid place-items-center text-[11px] font-semibold text-white ${e.color}`}>
                    {e.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-[11px] text-muted-foreground">{e.currency} · 2026 YTD</div>
                  </div>
                  {i === 0 && <Check className="h-4 w-4 text-primary" />}
                </div>
              ))}
              <div className="h-px bg-border my-1.5" />
              <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md">
                <Plus className="h-4 w-4" /> Add new entity
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard */}
        <div className="pl-[360px] h-full flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-4">
            {entities.map((e) => (
              <Card key={e.name} className="rounded-xl p-5">
                <div className="flex items-center gap-2.5">
                  <div className={`h-7 w-7 rounded-md grid place-items-center text-[10px] font-semibold text-white ${e.color}`}>
                    {e.initials}
                  </div>
                  <div className="text-sm font-medium truncate">{e.name}</div>
                </div>
                <div className="text-2xl font-semibold mt-3 tabular-nums">${e.revenue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{e.currency} · YTD revenue</div>
              </Card>
            ))}
            <Card className="rounded-xl p-5 bg-primary/10 border-primary/30">
              <div className="text-xs uppercase tracking-wide text-primary font-semibold">Consolidated</div>
              <div className="text-2xl font-semibold mt-3 text-primary tabular-nums">${consolidated.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">USD equivalent · YTD</div>
            </Card>
          </div>

          <Card className="rounded-xl p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold">Revenue by entity</div>
                <div className="text-xs text-muted-foreground">Last 5 months · USD equivalent</div>
              </div>
              <div className="flex gap-3 text-xs">
                {[
                  { l: 'Acme Studio', c: 'hsl(170 82% 26%)' },
                  { l: 'Müller GmbH', c: 'hsl(217 91% 60%)' },
                  { l: 'Lagos Builders', c: 'hsl(262 83% 58%)' },
                ].map(x => (
                  <span key={x.l} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />{x.l}
                  </span>
                ))}
              </div>
            </div>
            <div className="h-[440px]">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip />
                  <Bar dataKey="Acme"   stackId="a" fill="hsl(170 82% 26%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Müller" stackId="a" fill="hsl(217 91% 60%)" />
                  <Bar dataKey="Lagos"  stackId="a" fill="hsl(262 83% 58%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
