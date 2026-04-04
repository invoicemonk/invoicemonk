import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUpdateExpense, EXPENSE_CATEGORIES, Expense } from '@/hooks/use-expenses';
import { ReceiptUpload, type ScanResult } from './ReceiptUpload';
import { VendorCombobox } from './VendorCombobox';
import { useProductsServices } from '@/hooks/use-products-services';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useBusiness } from '@/contexts/BusinessContext';

const expenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().max(200).optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  vendor: z.string().max(50).optional(),
  expenseDate: z.string().optional(),
  notes: z.string().max(200).optional(),
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
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const { currentBusiness: business } = useBusiness();
  const { data: products = [] } = useProductsServices(currentCurrencyAccount?.id);
  const activeProducts = products.filter((p) => p.isActive);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [currencyMismatch, setCurrencyMismatch] = useState<{ detected: string; expected: string } | null>(null);

  const [linkedProductId, setLinkedProductId] = useState<string>(
    (expense as any).productServiceId || 'none'
  );

  const {
    register, handleSubmit, setValue, watch, reset, formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: expense.category, description: expense.description || '',
      amount: expense.amount, vendor: expense.vendor || '',
      expenseDate: expense.expenseDate, notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || null,
    },
  });

  const category = watch('category');
  const receiptUrl = watch('receiptUrl');

  useEffect(() => {
    reset({
      category: expense.category, description: expense.description || '',
      amount: expense.amount, vendor: expense.vendor || '',
      expenseDate: expense.expenseDate, notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || null,
    });
    setLinkedProductId((expense as any).productServiceId || 'none');
    setAiFilledFields(new Set());
    setCurrencyMismatch(null);
  }, [expense, reset]);

  const handleScanComplete = (data: ScanResult) => {
    const filled = new Set<string>();
    if (data.category) { setValue('category', data.category); filled.add('category'); }
    if (data.total_amount) { setValue('amount', data.total_amount); filled.add('amount'); }
    if (data.vendor_name) { setValue('vendor', data.vendor_name); filled.add('vendor'); }
    if (data.date) { setValue('expenseDate', data.date); filled.add('expenseDate'); }
    if (data.description) { setValue('description', data.description); filled.add('description'); }
    if (data.line_items?.length) {
      const itemLines = data.line_items.map(
        (item) => `${item.description}${item.quantity ? ` x${item.quantity}` : ''}: ${item.amount}`
      ).join('\n');
      setValue('notes', itemLines.slice(0, 200));
      filled.add('notes');
    }
    setAiFilledFields(filled);
    if (data.currency_mismatch && data.currency && data.business_currency) {
      setCurrencyMismatch({ detected: data.currency, expected: data.business_currency });
    } else {
      setCurrencyMismatch(null);
    }
  };

  const onSubmit = async (data: ExpenseFormData) => {
    await updateExpense.mutateAsync({
      id: expense.id,
      updates: {
        category: data.category, description: data.description, amount: data.amount,
        vendor: data.vendor, expenseDate: data.expenseDate, notes: data.notes,
        receiptUrl: data.receiptUrl || undefined,
        productServiceId: linkedProductId && linkedProductId !== 'none' ? linkedProductId : null,
      },
    });
    onOpenChange(false); onSuccess?.();
  };

  const AiBadge = ({ field }: { field: string }) =>
    aiFilledFields.has(field) ? (
      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 gap-0.5 font-normal">
        <Sparkles className="h-2.5 w-2.5" /> AI
      </Badge>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update the expense details. All fields marked with * are required.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {currencyMismatch && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  Receipt currency ({currencyMismatch.detected}) differs from your active currency ({currencyMismatch.expected}). Please verify the amount.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="category" className="flex items-center">Category *<AiBadge field="category" /></Label>
              <Select value={category} onValueChange={(v) => setValue('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="flex items-center">Amount *<AiBadge field="amount" /></Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseDate" className="flex items-center">Date<AiBadge field="expenseDate" /></Label>
                <Input id="expenseDate" type="date" {...register('expenseDate')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center">Description<AiBadge field="description" /></Label>
              <Input id="description" placeholder="Brief description of the expense" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">Vendor / Supplier<AiBadge field="vendor" /></Label>
              <VendorCombobox value={watch('vendor')} onChange={(val) => setValue('vendor', val)} />
            </div>

            {activeProducts.length > 0 && (
              <div className="space-y-2">
                <Label>Related Product/Service (optional)</Label>
                <Select value={linkedProductId} onValueChange={setLinkedProductId}>
                  <SelectTrigger><SelectValue placeholder="Link to a product or service..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {activeProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Enables future profit-per-product reporting</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center">Notes<AiBadge field="notes" /></Label>
              <Textarea id="notes" placeholder="Additional notes..." rows={2} {...register('notes')} />
            </div>

            <div className="space-y-2">
              <Label>Receipt</Label>
              <ReceiptUpload
                value={receiptUrl}
                onChange={(path) => setValue('receiptUrl', path)}
                onScanComplete={handleScanComplete}
                businessCurrency={activeCurrency}
                businessJurisdiction={business?.jurisdiction || ''}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
