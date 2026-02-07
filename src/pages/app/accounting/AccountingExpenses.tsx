import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, PieChart } from 'lucide-react';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';
import { ExpenseForm } from '@/components/accounting/ExpenseForm';
import { ExpenseList } from '@/components/accounting/ExpenseList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountingPreferences, AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useExpenses, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useExpensesByCategory } from '@/hooks/use-accounting-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useBusiness } from '@/contexts/BusinessContext';

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

const getCategoryLabel = (value: string) => {
  const category = EXPENSE_CATEGORIES.find(c => c.value === value);
  return category?.label || value;
};

export default function AccountingExpenses() {
  const { data: preferences } = useAccountingPreferences();
  const { currentBusiness: business } = useBusiness();
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'monthly');
  
  const dateRange = getAccountingDateRange(period);
  const { data: expenses, isLoading: isLoadingExpenses } = useExpenses(dateRange);
  const { data: categoryData, isLoading: isLoadingCategories } = useExpensesByCategory(dateRange);

  const currency = business?.default_currency || 'NGN';

  // Calculate total
  const totalExpenses = useMemo(() => {
    return (expenses || []).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const isLoading = isLoadingExpenses || isLoadingCategories;

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
          <h1 className="text-3xl font-bold tracking-tight">Money Out</h1>
          <p className="text-muted-foreground mt-1">
            Business expenses in {getPeriodLabel(period)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AccountingPeriodSelector value={period} onChange={setPeriod} />
          <ExpenseForm />
        </div>
      </div>

      {/* Stats card */}
      <div className="grid gap-4 md:grid-cols-2">
        <MoneyFlowCard
          title="Total Expenses"
          amount={totalExpenses}
          currency={currency}
          count={expenses?.length}
          countLabel="expenses"
          icon={TrendingDown}
          variant="warning"
        />

        {/* Category breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingCategories ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-6" />
                ))}
              </div>
            ) : categoryData && categoryData.length > 0 ? (
              <div className="space-y-3">
                {categoryData.slice(0, 5).map((item) => {
                  const percentage = totalExpenses > 0 
                    ? Math.round((item.amount / totalExpenses) * 100) 
                    : 0;
                  
                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {getCategoryLabel(item.category)}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(item.amount, currency)} ({percentage}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No expenses recorded yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expenses list */}
      <Card>
        <CardHeader>
          <CardTitle>All Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseList expenses={expenses || []} isLoading={isLoadingExpenses} />
        </CardContent>
      </Card>

      <AccountingDisclaimer type="expenses" />
    </motion.div>
  );
}
