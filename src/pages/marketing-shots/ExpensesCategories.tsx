import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { categoryColors, expensesByCategory } from './seed2';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const totals = Object.entries(expensesByCategory).map(([cat, rows]) => ({
  name: cat,
  value: rows.reduce((s, r) => s + r.amount, 0),
}));
const grandTotal = totals.reduce((s, t) => s + t.value, 0);
const palette = ['hsl(38 92% 50%)', 'hsl(217 91% 60%)', 'hsl(262 83% 58%)', 'hsl(160 84% 39%)'];

export default function ExpensesCategories() {
  return (
    <MarketingShotFrame
      active="expenses"
      pageTitle="Expenses by category"
      pageSubtitle="Auto-categorized from receipts and bank feeds · April 2026"
    >
      <div className="grid grid-cols-12 gap-6 h-full">
        <div className="col-span-8 space-y-4 overflow-hidden">
          {Object.entries(expensesByCategory).map(([cat, rows]) => {
            const c = categoryColors[cat];
            const sub = rows.reduce((s, r) => s + r.amount, 0);
            return (
              <Card key={cat} className="rounded-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-3 border-b bg-muted/30">
                  <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                  <div className="font-medium text-sm">{cat}</div>
                  <Badge variant="outline" className="text-[10px]">{rows.length} expenses</Badge>
                  <div className="ml-auto text-sm font-semibold tabular-nums">${sub.toFixed(2)}</div>
                </div>
                <div className="divide-y">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-12 px-5 py-2.5 text-sm items-center">
                      <div className="col-span-4 font-medium">{r.vendor}</div>
                      <div className="col-span-3 text-muted-foreground text-xs">{r.date}</div>
                      <div className="col-span-3 text-muted-foreground text-xs truncate">{r.note}</div>
                      <div className="col-span-2 text-right tabular-nums">${r.amount.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="col-span-4 space-y-4">
          <Card className="rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total expenses</div>
            <div className="text-3xl font-semibold mt-1 tabular-nums">${grandTotal.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">across {totals.length} categories</div>

            <div className="h-56 mt-4">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={totals} dataKey="value" innerRadius={60} outerRadius={88} paddingAngle={2}>
                    {totals.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-2">
              {totals.map((t, i) => {
                const c = categoryColors[t.name];
                const pct = (t.value / grandTotal) * 100;
                return (
                  <div key={t.name} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                    <span className="flex-1">{t.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
                    <span className="tabular-nums w-20 text-right">${t.value.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-xl p-5 bg-primary/5 border-primary/20">
            <div className="text-sm font-semibold text-primary">Smart insight</div>
            <div className="text-sm text-muted-foreground mt-1">
              Travel spend is up 38% vs March, driven by the Berlin client visit. All entries are auto-tagged for tax review.
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
