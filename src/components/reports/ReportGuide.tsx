import { HelpCircle, ChevronDown, FileSpreadsheet, FileJson, FileText, PieChart, BarChart3 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';

export function ReportGuide() {
  return (
    <Collapsible defaultOpen={false}>
      <Card className="border-dashed bg-muted/30">
        <CardContent className="p-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">How to use these reports</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 text-sm text-muted-foreground">
            <ul className="space-y-2 list-disc pl-4">
              <li>
                <strong className="text-foreground">Currency scoped:</strong> each report is tied to the currency account you have selected. Invoicemonk never mixes currencies in a single report, so switch currency accounts to see data in another currency.
              </li>
              <li>
                <strong className="text-foreground">Formats:</strong>
                <span className="inline-flex items-center gap-1 mx-1"><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</span> for Excel / Google Sheets,
                <span className="inline-flex items-center gap-1 mx-1"><FileText className="h-3.5 w-3.5" /> PDF</span> for sharing or filing,
                <span className="inline-flex items-center gap-1 mx-1"><FileJson className="h-3.5 w-3.5" /> JSON</span> for integrations.
              </li>
              <li>
                <strong className="text-foreground">Reports vs Analytics:</strong>
                <span className="inline-flex items-center gap-1 mx-1"><BarChart3 className="h-3.5 w-3.5" /> Reports</span> download data;
                <span className="inline-flex items-center gap-1 mx-1"><PieChart className="h-3.5 w-3.5" /> Analytics</span> shows charts and summaries on screen.
              </li>
              <li>
                <strong className="text-foreground">Compliance:</strong> every export includes a generated timestamp and, where applicable, verification hashes so you can prove the data has not changed since it was produced.
              </li>
            </ul>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
