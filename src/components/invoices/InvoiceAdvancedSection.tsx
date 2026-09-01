import type { ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InvoiceSectionHeader } from './InvoiceSectionHeader';

interface InvoiceAdvancedSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function InvoiceAdvancedSection({ open, onOpenChange, children }: InvoiceAdvancedSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CardContent className="p-0">
          <div className="p-6">
            <InvoiceSectionHeader
              title="Advanced options"
              description="Optional settings for special invoice situations and presentation."
              help="Most invoices do not need these settings. Open this section when you need a deposit or final invoice, a reverse charge, a different template, or a one-off brand color."
            >
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  {open ? 'Hide options' : 'Show options'}
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </InvoiceSectionHeader>
          </div>
          <CollapsibleContent>
            <div className="space-y-6 border-t p-6 pt-5">{children}</div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}