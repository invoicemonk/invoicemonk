import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Check, RotateCw, Save } from 'lucide-react';

const fields = [
  { label: 'Vendor', value: 'Hilton Berlin', confidence: 98 },
  { label: 'Date', value: 'May 2, 2026', confidence: 96 },
  { label: 'Amount', value: '€384.00', confidence: 99 },
  { label: 'Tax (19% VAT)', value: '€61.31', confidence: 92 },
  { label: 'Category', value: 'Travel · Lodging', confidence: 88 },
  { label: 'Currency', value: 'EUR', confidence: 99 },
];

export default function ReceiptsScanning() {
  return (
    <MarketingShotFrame
      active="receipts"
      pageTitle="Review extracted receipt"
      pageSubtitle="AI scanned in 1.2s · 6 fields detected · ready for review"
      headerRight={<><Button variant="outline"><RotateCw className="h-4 w-4 mr-2" />Re-scan</Button><Button><Save className="h-4 w-4 mr-2" />Save receipt</Button></>}
    >
      <div className="grid grid-cols-2 gap-6 h-full">
        {/* Receipt preview */}
        <Card className="rounded-xl shadow-sm p-6 overflow-hidden">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Original receipt</div>
          <div className="bg-muted/40 rounded-lg p-6 h-full flex items-center justify-center">
            <div className="bg-white text-foreground rounded-md shadow-md w-72 p-6 font-mono text-[11px] leading-relaxed border" style={{ minHeight: 540 }}>
              <div className="text-center font-bold text-base mb-1">HILTON BERLIN</div>
              <div className="text-center text-[10px] text-muted-foreground">Mohrenstraße 30 · 10117 Berlin</div>
              <div className="text-center text-[10px] text-muted-foreground mb-3">VAT DE128456789</div>
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between"><span>Date</span><span>02.05.2026</span></div>
              <div className="flex justify-between"><span>Folio</span><span>#048213</span></div>
              <div className="flex justify-between"><span>Guest</span><span>S. CHEN</span></div>
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between"><span>Room (1 night)</span><span>€280.00</span></div>
              <div className="flex justify-between"><span>Breakfast</span><span>€32.00</span></div>
              <div className="flex justify-between"><span>City tax</span><span>€10.69</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span>€322.69</span></div>
              <div className="flex justify-between"><span>VAT 19%</span><span>€61.31</span></div>
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between font-bold text-sm"><span>TOTAL EUR</span><span>€384.00</span></div>
              <div className="border-t border-dashed my-2" />
              <div className="text-center text-[10px]">PAID · VISA ****4421</div>
              <div className="text-center text-[10px] mt-1">Auth #220948 · Thank you</div>
              <div className="text-center mt-4 text-[9px] text-muted-foreground">|||| ||| | |||| ||  ||| | ||||</div>
            </div>
          </div>
        </Card>

        {/* Extracted fields */}
        <Card className="rounded-xl shadow-sm p-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium">Extracted fields</div>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5"><Check className="h-3 w-3 mr-1" />94% avg. confidence</Badge>
          </div>
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <span className={`text-[11px] tabular-nums ${f.confidence >= 95 ? 'text-primary' : f.confidence >= 90 ? 'text-foreground' : 'text-amber-700'}`}>{f.confidence}% confidence</span>
                </div>
                <Input value={f.value} readOnly className="font-medium" />
                <Progress value={f.confidence} className="h-1 mt-1.5" />
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30">Auto-matched: Lufthansa flight LH-410 · same trip</Badge>
          </div>
        </Card>
      </div>
    </MarketingShotFrame>
  );
}
