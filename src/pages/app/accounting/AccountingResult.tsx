import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, ArrowRight, ArrowDown, Minus } from 'lucide-react';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountingPreferences, AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useAccountingStats } from '@/hooks/use-accounting-stats';
import { useBusiness } from '@/contexts/BusinessContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MultiCurrencyIndicator } from '@/components/ui/multi-currency-indicator';

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  const symbol = symbols[currency] || currency;
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function AccountingResult() {
  const { data: preferences } = useAccountingPreferences();
  const { currentBusiness: business } = useBusiness();
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'monthly');
  
  const dateRange = getAccountingDateRange(period);
  const { data: stats, isLoading } = useAccountingStats(business?.id, business?.default_currency, dateRange);

  const currency = stats?.currency || 'NGN';
  const moneyIn = stats?.moneyIn || 0;
  const moneyOut = stats?.moneyOut || 0;
  const whatsLeft = stats?.whatsLeft || 0;
  const isPositive = whatsLeft >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <AccountingNavTabs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Result</h1>
          <p className="text-muted-foreground mt-1">
            What's left after expenses in {getPeriodLabel(period)}
          </p>
        </div>
        <AccountingPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Multi-currency indicator */}
      {!isLoading && (stats?.hasMultipleCurrencies || stats?.hasUnconvertibleAmounts) && (
        <MultiCurrencyIndicator
          hasMultipleCurrencies={stats?.hasMultipleCurrencies || false}
          hasUnconvertibleAmounts={stats?.hasUnconvertibleAmounts || false}
          excludedCount={(stats?.excludedInvoiceCount || 0) + (stats?.excludedExpenseCount || 0)}
          breakdown={stats?.currencyBreakdown?.invoices 
            ? Object.fromEntries(
                Object.entries(stats.currencyBreakdown.invoices).map(([k, v]) => [k, { total: v.total, count: v.count }])
              )
            : undefined
          }
          primaryCurrency={stats?.currency || 'NGN'}
          variant="card"
        />
      )}

      {/* Main result visualization */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px]" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-8">
              {/* Money In */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Money In</span>
                </div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(moneyIn, currency)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats?.moneyInCount || 0} paid invoices
                </p>
              </div>

              {/* Arrow down */}
              <div className="flex flex-col items-center">
                <ArrowDown className="h-8 w-8 text-muted-foreground" />
                <Minus className="h-4 w-4 text-muted-foreground -mt-1" />
              </div>

              {/* Money Out */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm font-medium">Money Out</span>
                </div>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(moneyOut, currency)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats?.expenseCount || 0} expenses
                </p>
              </div>

              {/* Equals line */}
              <div className="w-full max-w-md border-t-2 border-dashed border-border relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-card px-3 text-sm text-muted-foreground">
                  equals
                </span>
              </div>

              {/* What's Left */}
              <div className="text-center">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3",
                  isPositive 
                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                )}>
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-medium">What's Left</span>
                </div>
                <p className={cn(
                  "text-5xl font-bold",
                  isPositive 
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}>
                  {formatCurrency(whatsLeft, currency)}
                </p>
                <p className="text-muted-foreground mt-3">
                  {isPositive 
                    ? "Your business is profitable this period! 🎉"
                    : "Your expenses exceeded income this period."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn(
                "text-2xl font-bold",
                moneyIn > 0 && whatsLeft / moneyIn >= 0.2 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-foreground"
              )}>
                {moneyIn > 0 ? `${Math.round((whatsLeft / moneyIn) * 100)}%` : '0%'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Of money in retained
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expense Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn(
                "text-2xl font-bold",
                moneyIn > 0 && moneyOut / moneyIn <= 0.7 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-amber-600 dark:text-amber-400"
              )}>
                {moneyIn > 0 ? `${Math.round((moneyOut / moneyIn) * 100)}%` : '0%'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Of money in spent
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Outstanding Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(stats?.outstanding || 0, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.outstandingCount || 0} unpaid invoices
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <AccountingDisclaimer type="result" />
    </motion.div>
  );
}
