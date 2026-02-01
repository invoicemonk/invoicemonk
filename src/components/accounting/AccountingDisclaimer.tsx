import { AlertTriangle } from 'lucide-react';

interface Props {
  type?: 'overview' | 'income' | 'expenses' | 'result';
}

export function AccountingDisclaimer({ type = 'overview' }: Props) {
  const getMessage = () => {
    switch (type) {
      case 'income':
        return 'Money In figures are based on invoices marked as paid. This may differ from actual cash received.';
      case 'expenses':
        return 'Expenses are self-reported and not verified. This is for personal tracking purposes only.';
      case 'result':
        return 'The "What\'s Left" calculation is for informational purposes. Consult a qualified accountant for official financial statements.';
      default:
        return 'This accounting overview is for informational purposes only and does not constitute professional financial advice. Please consult a qualified accountant for tax and compliance matters.';
    }
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>{getMessage()}</p>
    </div>
  );
}
