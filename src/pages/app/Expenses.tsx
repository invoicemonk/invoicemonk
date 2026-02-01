import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Receipt, TrendingDown, Search, Filter, Download, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';
import { ExpenseForm } from '@/components/accounting/ExpenseForm';
import { ExpenseList } from '@/components/accounting/ExpenseList';
import { ExpenseEmptyState } from '@/components/accounting/ExpenseEmptyState';
import { useAccountingPreferences, AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useExpenses, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useExpensesByCategory } from '@/hooks/use-accounting-stats';
import { useUserBusiness } from '@/hooks/use-business';
import { useExportRecords } from '@/hooks/use-export';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function Expenses() {
  const { data: preferences } = useAccountingPreferences();
  const { data: business } = useUserBusiness();
  const { exportRecords, isExporting } = useExportRecords();
  
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const dateRange = getAccountingDateRange(period);
  const { data: expenses, isLoading: isLoadingExpenses } = useExpenses(dateRange);
  const { data: categoryData, isLoading: isLoadingCategories } = useExpensesByCategory(dateRange);

  const currency = business?.default_currency || 'NGN';

  // Filter expenses based on search and category
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    
    return expenses.filter((expense) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        expense.description?.toLowerCase().includes(searchLower) ||
        expense.vendor?.toLowerCase().includes(searchLower) ||
        expense.notes?.toLowerCase().includes(searchLower) ||
        getCategoryLabel(expense.category).toLowerCase().includes(searchLower);
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, categoryFilter]);

  // Calculate totals
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const allExpensesTotal = useMemo(() => {
    return (expenses || []).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const handleExport = async (format: 'csv' | 'json') => {
    await exportRecords({
      export_type: 'expenses',
      business_id: business?.id,
      date_from: dateRange.start.toISOString().split('T')[0],
      date_to: dateRange.end.toISOString().split('T')[0],
      format,
    });
  };

  const isLoading = isLoadingExpenses || isLoadingCategories;
  const hasExpenses = expenses && expenses.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Receipt className="h-8 w-8 text-primary" />
            Expenses
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your business expenses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AccountingPeriodSelector value={period} onChange={setPeriod} />
          <ExpenseForm />
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting || !hasExpenses}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('json')}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <MoneyFlowCard
          title={categoryFilter !== 'all' || searchQuery ? 'Filtered Expenses' : 'Total Expenses'}
          amount={totalExpenses}
          currency={currency}
          count={filteredExpenses.length}
          countLabel={`expenses in ${getPeriodLabel(period)}`}
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
                  const percentage = allExpensesTotal > 0 
                    ? Math.round((item.amount / allExpensesTotal) * 100) 
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
      {!isLoading && !hasExpenses ? (
        <ExpenseEmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {categoryFilter !== 'all' || searchQuery 
                  ? `Filtered Expenses (${filteredExpenses.length})` 
                  : 'All Expenses'
                }
              </span>
              {searchQuery || categoryFilter !== 'all' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseList 
              expenses={filteredExpenses} 
              isLoading={isLoadingExpenses} 
            />
          </CardContent>
        </Card>
      )}

      <AccountingDisclaimer type="expenses" />
    </motion.div>
  );
}
