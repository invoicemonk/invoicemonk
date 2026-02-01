import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  amount: number;
  currency: string;
  count?: number;
  countLabel?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const variantStyles = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

const iconBgStyles = {
  default: 'bg-muted',
  success: 'bg-emerald-100 dark:bg-emerald-500/20',
  warning: 'bg-amber-100 dark:bg-amber-500/20',
  danger: 'bg-red-100 dark:bg-red-500/20',
};

const iconColorStyles = {
  default: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

export function MoneyFlowCard({ 
  title, 
  amount, 
  currency, 
  count, 
  countLabel,
  icon: Icon,
  variant = 'default',
  className 
}: Props) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold tracking-tight", variantStyles[variant])}>
              {formatCurrency(amount, currency)}
            </p>
            {count !== undefined && (
              <p className="text-xs text-muted-foreground">
                {count} {countLabel || 'items'}
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-lg", iconBgStyles[variant])}>
            <Icon className={cn("h-5 w-5", iconColorStyles[variant])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
