import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, PieChart } from 'lucide-react';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';
import { ExpenseForm } from '@/components/accounting/ExpenseForm';
import { ExpenseList } from '@/components/accounting/ExpenseList';
import { RecurringExpenseDialog } from '@/components/accounting/RecurringExpenseDialog';
import { RecurringExpenseList } from '@/components/accounting/RecurringExpenseList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingPreferences, AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useExpenses, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useRecurringExpenses } from '@/hooks/use-recurring-expenses';
import { useExpensesByCategory } from '@/hooks/use-accounting-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { formatCurrency } from '@/lib/utils';

const getCategoryLabel = (value: string) => {
  const category = EXPENSE_CATEGORIES.find(c => c.value === value);
  return category?.label || value;
};

export default function AccountingExpenses() {
  const { data: preferences } = useAccountingPreferences();
  const { currentBusiness: business } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'monthly');
  
  const dateRange = getAccountingDateRange(period);
  const { data: expenses, isLoading: isLoadingExpenses } = useExpenses(
    business?.id, 
    currentCurrencyAccount?.id,
    dateRange ?? undefined
  );
  const { data: categoryData, isLoading: isLoadingCategories } = useExpensesByCategory(
    business?.id, 
    currentCurrencyAccount?.id,
    activeCurrency,
    dateRange ?? undefined
  );
  const { data: recurringExpenses, isLoading: isLoadingRecurring } = useRecurringExpenses(
    business?.id,
    currentCurrencyAccount?.id
  );

  const currency = activeCurrency || business?.default_currency || '';

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
            ) : categoryData && categoryData.data.length > 0 ? (
              <div className="space-y-3">
                {categoryData.data.slice(0, 5).map((item) => {
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

      {/* Tabs for All Expenses vs Recurring */}
      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Expenses</TabsTrigger>
            <TabsTrigger value="recurring">Recurring</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <RecurringExpenseDialog />
            <ExpenseForm />
          </div>
        </div>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseList expenses={expenses || []} isLoading={isLoadingExpenses} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring">
          <Card>
            <CardHeader>
              <CardTitle>Recurring Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <RecurringExpenseList
                expenses={recurringExpenses || []}
                isLoading={isLoadingRecurring}
                currency={currency}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AccountingDisclaimer type="expenses" />
    </motion.div>
  );
}
