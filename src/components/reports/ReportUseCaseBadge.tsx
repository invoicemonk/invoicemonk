import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReportType } from '@/hooks/use-reports';

type UseCase = 'tax' | 'accountant' | 'review' | 'compliance';

const USE_CASE_CONFIG: Record<UseCase, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  tax: { label: 'Tax / Filing', variant: 'secondary' },
  accountant: { label: 'Accountant', variant: 'outline' },
  review: { label: 'Business review', variant: 'default' },
  compliance: { label: 'Compliance proof', variant: 'outline' },
};

const REPORT_USE_CASES: Record<ReportType, UseCase> = {
  'invoice-register': 'accountant',
  'revenue-by-period': 'review',
  'revenue-by-client': 'review',
  'outstanding-report': 'review',
  'receipt-register': 'compliance',
  'expense-register': 'accountant',
  'expense-by-category': 'review',
  'expense-by-vendor': 'review',
  'income-statement': 'accountant',
  'cash-flow-summary': 'accountant',
  'tax-report': 'tax',
  'audit-export': 'compliance',
  'export-history': 'compliance',
};

interface ReportUseCaseBadgeProps {
  reportId: ReportType;
  className?: string;
}

export function ReportUseCaseBadge({ reportId, className }: ReportUseCaseBadgeProps) {
  const useCase = REPORT_USE_CASES[reportId];
  const config = USE_CASE_CONFIG[useCase];

  return (
    <Badge variant={config.variant} className={cn('text-xs font-medium', className)}>
      {config.label}
    </Badge>
  );
}
