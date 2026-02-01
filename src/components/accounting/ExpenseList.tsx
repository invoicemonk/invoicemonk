import { format } from 'date-fns';
import { Trash2, MoreHorizontal, Edit } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Expense, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';

interface Props {
  expenses: Expense[];
  isLoading?: boolean;
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

const getCategoryLabel = (value: string) => {
  const category = EXPENSE_CATEGORIES.find(c => c.value === value);
  return category?.label || value;
};

const getCategoryColor = (value: string): string => {
  const colors: Record<string, string> = {
    software: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    equipment: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
    travel: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300',
    meals: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
    office: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300',
    marketing: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300',
    professional: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
    utilities: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    rent: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
    insurance: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
    taxes: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    payroll: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
    other: 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300',
  };
  return colors[value] || colors.other;
};

export function ExpenseList({ expenses, isLoading }: Props) {
  const deleteExpense = useDeleteExpense();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No expenses recorded yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Click "Add Expense" to start tracking your business expenses.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="font-medium">
                {format(new Date(expense.expenseDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={getCategoryColor(expense.category)}>
                  {getCategoryLabel(expense.category)}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {expense.description || '-'}
              </TableCell>
              <TableCell className="max-w-[150px] truncate">
                {expense.vendor || '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(expense.amount, expense.currency)}
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this expense record.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteExpense.mutate(expense.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
