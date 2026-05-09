import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const templates = [
  { name: 'Modern', tone: 'Bold sans · accent stripe', accent: 'from-primary/90 to-primary' },
  { name: 'Classic', tone: 'Serif heading · ruled lines', accent: 'from-slate-700 to-slate-900' },
  { name: 'Minimal', tone: 'Mono labels · whitespace', accent: 'from-zinc-200 to-zinc-300' },
  { name: 'Studio', tone: 'Editorial layout · two-column', accent: 'from-primary/70 to-emerald-600' },
  { name: 'Construction', tone: 'Grid lines · phase blocks', accent: 'from-amber-500 to-amber-700' },
  { name: 'Boutique', tone: 'Script logo · gold details', accent: 'from-amber-300 to-amber-500' },
];

function Thumb({ accent, name }: { accent: string; name: string }) {
  return (
    <div className="aspect-[8.5/11] rounded-md border bg-card overflow-hidden flex flex-col">
      <div className={`h-12 bg-gradient-to-r ${accent}`} />
      <div className="p-3 space-y-2 flex-1">
        <div className="h-2 w-24 bg-foreground/80 rounded" />
        <div className="h-1.5 w-16 bg-muted-foreground/40 rounded" />
        <div className="mt-3 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-1">
              <div className="h-1.5 flex-1 bg-muted rounded" />
              <div className="h-1.5 w-6 bg-muted rounded" />
              <div className="h-1.5 w-8 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="mt-auto pt-2 flex justify-end">
          <div className="h-3 w-14 bg-primary/80 rounded" />
        </div>
        <div className="text-[9px] text-center text-muted-foreground tracking-wide pt-1">{name.toUpperCase()}</div>
      </div>
    </div>
  );
}

export default function EstimatesTemplates() {
  return (
    <MarketingShotFrame
      active="estimates"
      pageTitle="Estimate templates"
      pageSubtitle="Pick a starting point — every template uses your brand colors and logo automatically"
      headerRight={<Button variant="outline">Upload custom</Button>}
    >
      <div className="grid grid-cols-3 gap-6 h-full content-start">
        {templates.map((t, i) => (
          <Card key={t.name} className="rounded-xl shadow-sm p-5 group relative">
            {i === 3 && (
              <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">Most used</Badge>
            )}
            <Thumb accent={t.accent} name={t.name} />
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.tone}</div>
              </div>
              <Button size="sm" className={i === 3 ? '' : 'opacity-100'}>Use template</Button>
            </div>
          </Card>
        ))}
      </div>
    </MarketingShotFrame>
  );
}
