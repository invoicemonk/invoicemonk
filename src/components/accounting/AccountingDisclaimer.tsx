import { AlertTriangle } from 'lucide-react';

interface Props {
  type?: 'overview' | 'income' | 'expenses' | 'result';
}

export function AccountingDisclaimer({ type = 'overview' }: Props) {
  const getMessage = () => {
    switch (type) {
      case 'income':
        return 'Money In reflects invoices marked as paid. This may differ from actual bank deposits.';
      case 'expenses':
        return 'Expenses are self-reported for your tracking. They are not independently verified.';
      case 'result':
        return 'What\'s Left is an estimate based on your data. Consult your accountant for official statements.';
      default:
        return 'This summary is cash-based and does not replace professional accounting. It shows money received vs. money spent based on your records. For tax filings or audits, consult a qualified accountant.';
    }
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>{getMessage()}</p>
    </div>
  );
}
