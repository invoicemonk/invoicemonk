import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
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
import { EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useCreateRecurringExpense, FREQUENCY_OPTIONS } from '@/hooks/use-recurring-expenses';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { VendorPicker } from '@/components/vendors/VendorPicker';
import { ReceiptUpload } from './ReceiptUpload';
import { useProductsServices } from '@/hooks/use-products-services';

const schema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().max(200).optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  vendor: z.string().max(50).optional(),
  frequency: z.string().min(1, 'Frequency is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  notes: z.string().max(200).optional(),
  receiptUrl: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function RecurringExpenseDialog() {
  const [open, setOpen] = useState(false);
  const { currentBusiness: business } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const { data: products = [] } = useProductsServices(currentCurrencyAccount?.id);
  const createRecurring = useCreateRecurringExpense(
    business?.id,
    currentCurrencyAccount?.id,
    activeCurrency
  );

  const [linkedProductId, setLinkedProductId] = useState<string>('none');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: '',
      description: '',
      amount: 0,
      vendor: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      notes: '',
      receiptUrl: null,
    },
  });

  const category = watch('category');
  const frequency = watch('frequency');
  const receiptUrl = watch('receiptUrl');
  const activeProducts = products.filter((p) => p.isActive);

  const onSubmit = async (data: FormData) => {
    if (!currentCurrencyAccount) return;
    await createRecurring.mutateAsync({
      category: data.category,
      description: data.description,
      amount: data.amount,
      vendor: data.vendor,
      frequency: data.frequency as any,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      notes: data.notes,
      receiptUrl: data.receiptUrl || undefined,
      productServiceId: linkedProductId !== 'none' ? linkedProductId : null,
    });

    reset();
    setLinkedProductId('none');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          New Recurring
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New Recurring Expense</DialogTitle>
            <DialogDescription>
              Set up an expense that repeats automatically in {activeCurrency}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setValue('category', v)}>
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
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount ({activeCurrency}) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Frequency *</Label>
                <Select value={frequency} onValueChange={(v) => setValue('frequency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" {...register('startDate')} />
                {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input type="date" {...register('endDate')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief description" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Vendor / Supplier</Label>
              <VendorPicker value={watch('vendor')} onChange={({ vendor }) => setValue('vendor', vendor)} />
            </div>

            {activeProducts.length > 0 && (
              <div className="space-y-2">
                <Label>Related Product/Service (optional)</Label>
                <Select value={linkedProductId} onValueChange={setLinkedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Link to a product or service..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {activeProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." rows={2} {...register('notes')} />
            </div>

            <div className="space-y-2">
              <Label>Receipt</Label>
              <ReceiptUpload value={receiptUrl} onChange={(path) => setValue('receiptUrl', path)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRecurring.isPending || !currentCurrencyAccount}>
              {createRecurring.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Recurring Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
