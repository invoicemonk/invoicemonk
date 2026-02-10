import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateExpense, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { ReceiptUpload } from './ReceiptUpload';
import { VendorCombobox } from './VendorCombobox';

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
  onSuccess?: () => void;
}

export function ExpenseForm({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const { currentBusiness: business } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  
  // Currency is now derived from the active currency account
  const createExpense = useCreateExpense(
    business?.id, 
    currentCurrencyAccount?.id,
    activeCurrency
  );

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
      category: '',
      description: '',
      amount: 0,
      vendor: '',
      expenseDate: new Date().toISOString().split('T')[0],
      notes: '',
      receiptUrl: null,
    },
  });

  const category = watch('category');
  const receiptUrl = watch('receiptUrl');

  const onSubmit = async (data: ExpenseFormData) => {
    if (!currentCurrencyAccount) {
      return;
    }

    await createExpense.mutateAsync({
      category: data.category,
      description: data.description,
      amount: data.amount,
      vendor: data.vendor,
      expenseDate: data.expenseDate,
      notes: data.notes,
      receiptUrl: data.receiptUrl || undefined,
    });
    
    reset();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Record a business expense in {activeCurrency}. All fields marked with * are required.
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

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({activeCurrency}) *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the expense"
                {...register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label>Vendor / Supplier</Label>
              <VendorCombobox
                value={watch('vendor')}
                onChange={(val) => setValue('vendor', val)}
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createExpense.isPending || !currentCurrencyAccount}
            >
              {createExpense.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
