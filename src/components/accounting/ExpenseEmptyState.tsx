import { Receipt } from 'lucide-react';
import { ExpenseForm } from './ExpenseForm';

export function ExpenseEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-6">
        <Receipt className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No expenses recorded yet</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Track your business spending to get a clear picture of where your money goes. 
        Start by recording your first expense.
      </p>
      <ExpenseForm />
    </div>
  );
}
