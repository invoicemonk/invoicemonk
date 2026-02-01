import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateExpense, EXPENSE_CATEGORIES, Expense } from '@/hooks/use-expenses';
import { ReceiptUpload } from './ReceiptUpload';

const expenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  vendor: z.string().optional(),
  expenseDate: z.string().optional(),
  notes: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface Props {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ExpenseEditDialog({ expense, open, onOpenChange, onSuccess }: Props) {
  const updateExpense = useUpdateExpense();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: expense.category,
      description: expense.description || '',
      amount: expense.amount,
      vendor: expense.vendor || '',
      expenseDate: expense.expenseDate,
      notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || null,
    },
  });

  const category = watch('category');
  const receiptUrl = watch('receiptUrl');

  // Reset form when expense changes
  useEffect(() => {
    reset({
      category: expense.category,
      description: expense.description || '',
      amount: expense.amount,
      vendor: expense.vendor || '',
      expenseDate: expense.expenseDate,
      notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || null,
    });
  }, [expense, reset]);

  const onSubmit = async (data: ExpenseFormData) => {
    await updateExpense.mutateAsync({
      id: expense.id,
      updates: {
        category: data.category,
        description: data.description,
        amount: data.amount,
        vendor: data.vendor,
        expenseDate: data.expenseDate,
        notes: data.notes,
        receiptUrl: data.receiptUrl || undefined,
      },
    });
    
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the expense details. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={(value) => setValue('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expenseDate">Date</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  {...register('expenseDate')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the expense"
                {...register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor / Supplier</Label>
              <Input
                id="vendor"
                placeholder="Who did you pay?"
                {...register('vendor')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                rows={2}
                {...register('notes')}
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt</Label>
              <ReceiptUpload
                value={receiptUrl}
                onChange={(path) => setValue('receiptUrl', path)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateExpense.isPending}>
              {updateExpense.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
