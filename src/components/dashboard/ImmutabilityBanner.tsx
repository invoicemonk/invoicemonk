import { Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ImmutabilityBanner() {
  return (
    <Alert className="bg-muted/30 border-border/50">
      <Shield className="h-4 w-4" />
      <AlertDescription className="text-sm text-muted-foreground">
        Invoices are immutable once issued. Corrections require credit notes.
      </AlertDescription>
    </Alert>
  );
}
