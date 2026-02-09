import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Receipt, TrendingDown, Search, Filter, Download, PieChart, Edit, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DemoLayout } from './DemoLayout';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';

// Sample expense data
const sampleExpenses = [
  { 
    id: '1', 
    category: 'software', 
    vendor: 'Microsoft Azure', 
    description: 'Cloud hosting subscription',
    amount: 125000, 
    expense_date: '2026-02-01',
    currency: 'NGN'
  },
  { 
    id: '2', 
    category: 'travel', 
    vendor: 'Air Peace', 
    description: 'Lagos to Abuja flight - client meeting',
    amount: 85000, 
    expense_date: '2026-01-28',
    currency: 'NGN'
  },
  { 
    id: '3', 
    category: 'office_supplies', 
    vendor: 'Rymeks Office', 
    description: 'Printer paper and stationery',
    amount: 35000, 
    expense_date: '2026-02-03',
    currency: 'NGN'
  },
  { 
    id: '4', 
    category: 'utilities', 
    vendor: 'Eko Electricity', 
    description: 'Office electricity bill - January',
    amount: 68000, 
    expense_date: '2026-02-02',
    currency: 'NGN'
  },
  { 
    id: '5', 
    category: 'professional_services', 
    vendor: 'KPMG Nigeria', 
    description: 'Quarterly accounting services',
    amount: 250000, 
    expense_date: '2026-01-25',
    currency: 'NGN'
  },
  { 
    id: '6', 
    category: 'marketing', 
    vendor: 'Meta Ads', 
    description: 'Facebook & Instagram advertising',
    amount: 180000, 
    expense_date: '2026-02-05',
    currency: 'NGN'
  },
  { 
    id: '7', 
    category: 'software', 
    vendor: 'Slack Technologies', 
    description: 'Team communication platform',
    amount: 45000, 
    expense_date: '2026-02-01',
    currency: 'NGN'
  },
  { 
    id: '8', 
    category: 'travel', 
    vendor: 'Uber Nigeria', 
    description: 'Client site visits - multiple trips',
    amount: 28000, 
    expense_date: '2026-02-06',
    currency: 'NGN'
  },
];

const EXPENSE_CATEGORIES = [
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'travel', label: 'Travel & Transportation' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'marketing', label: 'Marketing & Advertising' },
];

const getCategoryLabel = (value: string) => {
  const category = EXPENSE_CATEGORIES.find(c => c.value === value);
  return category?.label || value;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    software: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    travel: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    office_supplies: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    utilities: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    professional_services: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    marketing: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  };
  return colors[category] || 'bg-muted text-muted-foreground';
};

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, yyyy');
};

// Stats
const totalExpenses = sampleExpenses.reduce((sum, e) => sum + e.amount, 0);

// Category breakdown
const categoryBreakdown = EXPENSE_CATEGORIES.map(cat => {
  const expenses = sampleExpenses.filter(e => e.category === cat.value);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return {
    category: cat.value,
    label: cat.label,
    amount: total,
    percentage: Math.round((total / totalExpenses) * 100)
  };
}).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

export default function DemoExpenses() {
  return (
    <DemoLayout>
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
              Track and manage your business expenses in NGN
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">This Month</Button>
            <Button>
              <Receipt className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              className="pl-9"
              disabled
            />
          </div>
          <Select defaultValue="all">
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
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <MoneyFlowCard
            title="Total Expenses"
            amount={totalExpenses}
            currency="NGN"
            count={sampleExpenses.length}
            countLabel="expenses this month"
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
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 5).map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(item.amount)} ({item.percentage}%)
                      </span>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(expense.expense_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {expense.description}
                    </TableCell>
                    <TableCell>{expense.vendor}</TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(expense.category)}>
                        {getCategoryLabel(expense.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-600">
                      {formatCurrency(expense.amount, expense.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </DemoLayout>
  );
}
