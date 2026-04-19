import { Sparkles, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Informational banner shown to French-jurisdiction businesses about the
 * upcoming Sept 2026 e-invoicing mandate (Réforme de la facturation électronique).
 *
 * Lives on the dashboard until certified PDP routing is shipped (Phase 3).
 */
export function FrEInvoicingBanner() {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold leading-tight">
                France e-invoicing — coming 1 Sept 2026
              </p>
              <Badge variant="secondary" className="text-[10px]">
                Factur-X · UBL · CII
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              All French B2B invoices will need to be transmitted via a certified PDP or the
              public PPF. Invoicemonk already generates Factur-X artifacts — PDP routing
              ships ahead of the mandate.
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 self-start sm:self-center"
        >
          <a
            href="https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
