import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';
import { PROVIDER_TYPES, PROVIDER_INSTRUCTION_FIELDS } from '@/hooks/use-payment-methods';

interface PaymentMethodCardProps {
  snapshot: {
    provider_type: string;
    display_name: string;
    instructions: Record<string, string>;
  };
  invoiceNumber?: string;
}

export function PaymentMethodCard({ snapshot, invoiceNumber }: PaymentMethodCardProps) {
  const providerLabel = PROVIDER_TYPES.find(p => p.value === snapshot.provider_type)?.label || snapshot.provider_type;
  const fields = PROVIDER_INSTRUCTION_FIELDS[snapshot.provider_type] || [];
  const formatted = fields
    .filter(f => snapshot.instructions[f.key])
    .map(f => ({ label: f.label, value: snapshot.instructions[f.key] }));

  // For "other" provider with free-form details
  if (snapshot.provider_type === 'other' && snapshot.instructions.details) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Payment Instructions
            <Badge variant="outline" className="text-xs">{providerLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm whitespace-pre-wrap">{snapshot.instructions.details}</p>
          {invoiceNumber && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">Reference: <span className="font-mono font-medium text-foreground">{invoiceNumber}</span></p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Payment Instructions
          <Badge variant="outline" className="text-xs">{providerLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {formatted.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground shrink-0">{label}</span>
              <span className="font-mono text-right truncate">{value}</span>
            </div>
          ))}
        </div>
        {invoiceNumber && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono font-medium">{invoiceNumber}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
