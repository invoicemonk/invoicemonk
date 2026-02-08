import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, HelpCircle } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useCreateExpense, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useBusiness } from '@/contexts/BusinessContext';
import { ReceiptUpload } from './ReceiptUpload';
import { ExchangeRateInput } from '@/components/app/ExchangeRateInput';

const currencies = [
  { value: 'NGN', label: 'Nigerian Naira (₦)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'EUR', label: 'Euro (€)' },
];

const expenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  vendor: z.string().optional(),
  expenseDate: z.string().optional(),
  notes: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
  currency: z.string().optional(),
  exchangeRateToPrimary: z.number().optional().nullable(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface Props {
  onSuccess?: () => void;
}

export function ExpenseForm({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const { currentBusiness: business } = useBusiness();
  const createExpense = useCreateExpense(business?.id, business?.default_currency);

  const primaryCurrency = business?.default_currency || 'NGN';
  const allowedCurrencies = (business as any)?.allowed_currencies || [];
  const availableCurrencies = [primaryCurrency, ...allowedCurrencies];

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
      currency: primaryCurrency,
      exchangeRateToPrimary: null,
    },
  });

  const category = watch('category');
  const receiptUrl = watch('receiptUrl');
  const selectedCurrency = watch('currency') || primaryCurrency;
  const amount = watch('amount') || 0;
  const exchangeRate = watch('exchangeRateToPrimary');

  const needsExchangeRate = selectedCurrency !== primaryCurrency;

  // Reset exchange rate when currency changes to primary
  useEffect(() => {
    if (selectedCurrency === primaryCurrency) {
      setValue('exchangeRateToPrimary', null);
    }
  }, [selectedCurrency, primaryCurrency, setValue]);

  const onSubmit = async (data: ExpenseFormData) => {
    // Validate exchange rate for non-primary currencies
    if (needsExchangeRate && (!data.exchangeRateToPrimary || data.exchangeRateToPrimary <= 0)) {
      return;
    }

    await createExpense.mutateAsync({
      category: data.category,
      description: data.description,
      amount: data.amount,
      vendor: data.vendor,
      expenseDate: data.expenseDate,
      notes: data.notes,
      currency: data.currency || primaryCurrency,
      receiptUrl: data.receiptUrl || undefined,
      exchangeRateToPrimary: needsExchangeRate ? data.exchangeRateToPrimary ?? undefined : undefined,
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
              Record a business expense. All fields marked with * are required.
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
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={selectedCurrency} 
                  onValueChange={(value) => setValue('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies
                      .filter(c => availableCurrencies.includes(c.value))
                      .map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Exchange Rate Input - only show when currency differs from primary */}
            {needsExchangeRate && (
              <ExchangeRateInput
                fromCurrency={selectedCurrency}
                toCurrency={primaryCurrency}
                value={exchangeRate}
                onChange={(rate) => setValue('exchangeRateToPrimary', rate)}
                amount={amount}
                required
              />
            )}

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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createExpense.isPending || (needsExchangeRate && !exchangeRate)}
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
