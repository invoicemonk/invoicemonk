import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Receipt, AlertCircle, Info } from 'lucide-react';
import { useEligibleDepositInvoices } from '@/hooks/use-eligible-deposit-invoices';
import type { Database } from '@/integrations/supabase/types';

type InvoiceKind = Database['public']['Enums']['invoice_kind'];

interface DepositInvoiceSectionProps {
  businessId: string | undefined;
  clientId: string | undefined;
  currency: string | undefined;
  kind: InvoiceKind;
  depositPercent: number | null;
  parentInvoiceId: string | null;
  onKindChange: (kind: InvoiceKind) => void;
  onDepositPercentChange: (percent: number | null) => void;
  onParentInvoiceIdChange: (id: string | null) => void;
  /** Set when editing an existing invoice — disables editing if invoice has been issued */
  disabled?: boolean;
  /** Exclude this invoice from "already consumed" check (for editing) */
  currentInvoiceId?: string;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function DepositInvoiceSection({
  businessId,
  clientId,
  currency,
  kind,
  depositPercent,
  parentInvoiceId,
  onKindChange,
  onDepositPercentChange,
  onParentInvoiceIdChange,
  disabled = false,
  currentInvoiceId,
}: DepositInvoiceSectionProps) {
  const { data: deposits, isLoading } = useEligibleDepositInvoices(
    businessId,
    clientId,
    currency,
    currentInvoiceId,
  );

  const isDeposit = kind === 'deposit';
  const isFinal = kind === 'final';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Deposit / Final Invoice
        </CardTitle>
        <CardDescription>
          Optionally mark this as a deposit (advance payment) invoice, or link it to a previously issued deposit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deposit toggle */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="deposit-toggle" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              This is a deposit invoice
            </Label>
            <p className="text-xs text-muted-foreground">
              Collect an advance / down payment. The final invoice will credit this deposit.
            </p>
          </div>
          <Switch
            id="deposit-toggle"
            checked={isDeposit}
            disabled={disabled || isFinal}
            onCheckedChange={(checked) => {
              if (checked) {
                onKindChange('deposit');
                onParentInvoiceIdChange(null);
                if (depositPercent === null) onDepositPercentChange(50);
              } else {
                onKindChange('standard');
                onDepositPercentChange(null);
              }
            }}
          />
        </div>

        {isDeposit && (
          <div className="space-y-2 pl-3 border-l-2 border-primary/40">
            <Label htmlFor="deposit-percent">Deposit percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                id="deposit-percent"
                type="number"
                min="1"
                max="100"
                step="1"
                value={depositPercent ?? ''}
                disabled={disabled}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onDepositPercentChange(Number.isFinite(v) ? v : null);
                }}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">% of total project value</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Informational only — line items above determine the actual amount charged.
            </p>
          </div>
        )}

        {/* Final-invoice link picker */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="final-toggle" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              This is a final invoice (consumes a deposit)
            </Label>
            <p className="text-xs text-muted-foreground">
              Pick the deposit invoice that was already paid. It will be credited on this invoice.
            </p>
          </div>
          <Switch
            id="final-toggle"
            checked={isFinal}
            disabled={disabled || isDeposit}
            onCheckedChange={(checked) => {
              if (checked) {
                onKindChange('final');
                onDepositPercentChange(null);
              } else {
                onKindChange('standard');
                onParentInvoiceIdChange(null);
              }
            }}
          />
        </div>

        {isFinal && (
          <div className="space-y-2 pl-3 border-l-2 border-primary/40">
            <Label>Linked deposit invoice</Label>
            {!clientId || !currency ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Select a client and currency above to see eligible deposit invoices.
                </AlertDescription>
              </Alert>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading deposit invoices…</p>
            ) : !deposits || deposits.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No eligible deposit invoices</AlertTitle>
                <AlertDescription>
                  This client has no paid/issued deposit invoices in {currency} that haven't already been finalised.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Select
                  value={parentInvoiceId ?? ''}
                  onValueChange={(v) => onParentInvoiceIdChange(v || null)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a deposit invoice…" />
                  </SelectTrigger>
                  <SelectContent>
                    {deposits.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.invoice_number}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatMoney(Number(d.amount_paid || 0), d.currency)} paid
                          </Badge>
                          {d.deposit_percent != null && (
                            <span className="text-xs text-muted-foreground">
                              ({d.deposit_percent}%)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The deposit amount will be deducted from this invoice's total balance due.
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
