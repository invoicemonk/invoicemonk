import { format } from 'date-fns';
import { Pause, Play, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RecurringExpense,
  useDeleteRecurringExpense,
  useToggleRecurringExpense,
  FREQUENCY_OPTIONS,
} from '@/hooks/use-recurring-expenses';
import { EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { formatCurrency } from '@/lib/utils';

interface Props {
  expenses: RecurringExpense[];
  isLoading: boolean;
  currency: string;
}

const getCategoryLabel = (value: string) =>
  EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;

const getFrequencyLabel = (value: string) =>
  FREQUENCY_OPTIONS.find((f) => f.value === value)?.label || value;

export function RecurringExpenseList({ expenses, isLoading, currency }: Props) {
  const toggleRecurring = useToggleRecurringExpense();
  const deleteRecurring = useDeleteRecurringExpense();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium">No recurring expenses</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Set up expenses that repeat automatically on a schedule.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead>Next Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell className="font-medium">{getCategoryLabel(expense.category)}</TableCell>
            <TableCell className="text-muted-foreground max-w-[200px] truncate">
              {expense.description || expense.vendor || '—'}
            </TableCell>
            <TableCell>{formatCurrency(expense.amount, currency)}</TableCell>
            <TableCell>
              <Badge variant="outline">{getFrequencyLabel(expense.frequency)}</Badge>
            </TableCell>
            <TableCell>
              {format(new Date(expense.nextExpenseDate), 'MMM d, yyyy')}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Switch
                  checked={expense.isActive}
                  onCheckedChange={(checked) =>
                    toggleRecurring.mutate({ id: expense.id, isActive: checked })
                  }
                  disabled={toggleRecurring.isPending}
                />
                <span className="text-xs text-muted-foreground">
                  {expense.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteRecurring.mutate(expense.id)}
                disabled={deleteRecurring.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
