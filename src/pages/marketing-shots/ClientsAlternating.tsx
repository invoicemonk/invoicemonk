import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const top5 = [
  { name: 'Acme Studio', value: 48200 },
  { name: 'Müller GmbH', value: 41600 },
  { name: 'Lagos Builders', value: 38900 },
  { name: 'Nairobi Coffee', value: 27500 },
  { name: 'Studio Aurora', value: 22100 },
];

const newByMonth = [
  { m: 'Dec', v: 6 }, { m: 'Jan', v: 9 }, { m: 'Feb', v: 7 },
  { m: 'Mar', v: 11 }, { m: 'Apr', v: 14 }, { m: 'May', v: 12 },
];

export default function ClientsAlternating() {
  return (
    <MarketingShotFrame
      active="clients"
      pageTitle="Clients overview"
      pageSubtitle="Snapshot across your entire client base"
      headerRight={<Button><Plus className="h-4 w-4 mr-2" />Add client</Button>}
    >
      <div className="space-y-6 h-full">
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: 'Total clients', value: '184', delta: '+12 this month', up: true },
            { label: 'New this month', value: '12', delta: '+33% vs Apr', up: true },
            { label: 'Active retainers', value: '38', delta: '+4 vs Apr', up: true },
            { label: 'Churn rate', value: '1.2%', delta: '-0.3pp vs Apr', up: false },
          ].map((k) => (
            <Card key={k.label} className="rounded-xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="text-3xl font-semibold mt-2 tabular-nums">{k.value}</div>
              <div className={`mt-2 text-xs flex items-center gap-1 ${k.up ? 'text-primary' : 'text-emerald-700'}`}>
                {k.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {k.delta}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <Card className="col-span-2 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-semibold">Top 5 clients by revenue</div>
                <div className="text-xs text-muted-foreground">Last 12 months · USD equivalent</div>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">YTD</Badge>
            </div>
            <div style={{ height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={top5} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={110} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-xl shadow-sm p-6">
            <div className="text-base font-semibold">New clients</div>
            <div className="text-xs text-muted-foreground mb-4">Last 6 months</div>
            <div style={{ height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={newByMonth} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="v" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
