import { MarketingShotFrame } from './MarketingShotFrame';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Camera, Check, Receipt as ReceiptIcon } from 'lucide-react';

const Field = ({ label, value, confidence }: { label: string; value: string; confidence: number }) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[10px]">
        {confidence}% match
      </Badge>
    </div>
    <Input value={value} readOnly className="border-0 px-0 text-base font-medium focus-visible:ring-0" />
    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${confidence}%` }} />
    </div>
  </div>
);

export default function ExpensesReceiptScanning() {
  return (
    <MarketingShotFrame
      active="expenses"
      pageTitle="Capture expense"
      pageSubtitle="Snap a receipt and let AI fill in the details."
      headerRight={
        <Badge className="bg-primary/10 text-primary border-primary/30 border" variant="outline">
          <Sparkles className="h-3 w-3 mr-1" /> AI extraction
        </Badge>
      }
    >
      <div className="grid grid-cols-12 gap-6 h-full">
        {/* Phone capture */}
        <div className="col-span-5 flex items-center justify-center">
          <div className="relative w-[320px] h-[640px] rounded-[44px] border-[10px] border-foreground/90 bg-card shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/90 rounded-b-2xl z-10" />
            <div className="h-full bg-muted/40 flex flex-col">
              <div className="h-12 flex items-center justify-center text-xs font-medium text-muted-foreground pt-2">
                9:41
              </div>
              <div className="px-4 text-sm font-semibold mb-2">Scan receipt</div>
              <div className="mx-4 flex-1 rounded-2xl bg-background border-2 border-dashed border-primary/30 p-3 flex flex-col">
                <div className="flex-1 rounded-xl bg-gradient-to-b from-amber-50 to-amber-100/60 p-4 text-[10px] font-mono text-foreground/80 leading-relaxed shadow-inner">
                  <div className="text-center font-bold text-sm mb-2">HILTON BERLIN</div>
                  <div className="text-center mb-3 text-[9px]">Mohrenstraße 30, 10117 Berlin</div>
                  <div className="border-t border-dashed border-foreground/30 my-2" />
                  <div>Date: 02 May 2026</div>
                  <div>Folio #: 884219</div>
                  <div>Guest: S. Chen</div>
                  <div className="border-t border-dashed border-foreground/30 my-2" />
                  <div className="flex justify-between"><span>Room (2 nights)</span><span>€340.00</span></div>
                  <div className="flex justify-between"><span>City tax</span><span>€11.00</span></div>
                  <div className="flex justify-between"><span>VAT 19%</span><span>€33.00</span></div>
                  <div className="border-t border-dashed border-foreground/30 my-2" />
                  <div className="flex justify-between font-bold"><span>TOTAL</span><span>€384.00</span></div>
                  <div className="border-t border-dashed border-foreground/30 my-2" />
                  <div className="text-center text-[9px] mt-2">Card ending 4421 · Approved</div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium">
                  <Check className="h-3.5 w-3.5" /> Receipt detected
                </div>
              </div>
              <div className="p-4">
                <button className="w-full h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold">
                  <Camera className="h-4 w-4" /> Capture
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Extracted */}
        <div className="col-span-7">
          <Card className="rounded-xl p-6 h-full flex flex-col">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
                <ReceiptIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Extracted from receipt</div>
                <div className="text-xs text-muted-foreground">Hilton Berlin · folio 884219.pdf</div>
              </div>
              <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5">
                <Sparkles className="h-3 w-3 mr-1" /> 96% overall confidence
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <Field label="Vendor"   value="Hilton Berlin" confidence={98} />
              <Field label="Date"     value="May 2, 2026"   confidence={99} />
              <Field label="Amount"   value="€384.00"       confidence={97} />
              <Field label="Currency" value="EUR"           confidence={99} />
              <Field label="Category" value="Travel · Lodging" confidence={92} />
              <Field label="VAT (19%)" value="€33.00"      confidence={94} />
            </div>

            <div className="mt-5 rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
              <div className="font-medium text-primary mb-1">Suggested tax treatment</div>
              <div className="text-muted-foreground">100% deductible business travel · linked to client visit “Müller GmbH — Berlin (May 2–4)”.</div>
            </div>

            <div className="mt-auto pt-5 flex items-center justify-between border-t mt-5">
              <div className="text-xs text-muted-foreground">Original PDF stored in evidence vault.</div>
              <div className="flex gap-2">
                <Button variant="outline">Edit fields</Button>
                <Button>Save expense</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MarketingShotFrame>
  );
}
