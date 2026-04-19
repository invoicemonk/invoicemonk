import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Save, Trash2, Merge as MergeIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useUpdateVendor,
  useDeleteVendor,
  useVendorExpenses,
  useVendorStats,
  type Vendor,
} from '@/hooks/use-vendors';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { formatCurrency } from '@/lib/utils';
import { MergeVendorsDialog } from './MergeVendorsDialog';
import { INPUT_LIMITS } from '@/lib/input-limits';

interface VendorDetailSheetProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getCategoryLabel = (value: string | null) => {
  if (!value) return null;
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
};

export function VendorDetailSheet({ vendor, open, onOpenChange }: VendorDetailSheetProps) {
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const { data: stats } = useVendorStats(vendor?.id, currentCurrencyAccount?.id);
  const { data: expenses, isLoading: loadingExpenses } = useVendorExpenses(vendor?.id, 50);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [notes, setNotes] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setEmail(vendor.email || '');
      setPhone(vendor.phone || '');
      setTaxId(vendor.tax_id || '');
      setNotes(vendor.notes || '');
    }
  }, [vendor]);

  if (!vendor) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    await updateVendor.mutateAsync({
      id: vendor.id,
      updates: {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        notes: notes.trim() || null,
      },
    });
  };

  const handleDelete = async () => {
    await deleteVendor.mutateAsync(vendor.id);
    setShowDelete(false);
    onOpenChange(false);
  };

  const dirty =
    name.trim() !== vendor.name ||
    email !== (vendor.email || '') ||
    phone !== (vendor.phone || '') ||
    taxId !== (vendor.tax_id || '') ||
    notes !== (vendor.notes || '');

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{vendor.name}</SheetTitle>
            <SheetDescription>
              View and manage vendor details, spend history, and merge duplicates.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">All-time spend</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(stats?.total_spend_all_time || 0, activeCurrency)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-semibold">{stats?.expense_count || 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Last paid</p>
                <p className="text-sm font-medium">
                  {stats?.last_paid ? format(new Date(stats.last_paid), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Top category</p>
                <p className="text-sm font-medium truncate">
                  {getCategoryLabel(stats?.top_category ?? null) || '—'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Edit form */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Vendor details</h3>
              <div className="space-y-2">
                <Label htmlFor="vd-name">Name *</Label>
                <Input
                  id="vd-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={INPUT_LIMITS.SHORT_TEXT}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vd-email">Email</Label>
                  <Input
                    id="vd-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={INPUT_LIMITS.EMAIL}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vd-phone">Phone</Label>
                  <Input
                    id="vd-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={INPUT_LIMITS.PHONE}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vd-tax">Tax ID</Label>
                <Input
                  id="vd-tax"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  maxLength={INPUT_LIMITS.TAX_ID}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vd-notes">Notes</Label>
                <Textarea
                  id="vd-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleSave} disabled={!dirty || !name.trim() || updateVendor.isPending}>
                  {updateVendor.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button variant="outline" onClick={() => setShowMerge(true)}>
                  <MergeIcon className="h-4 w-4 mr-2" />
                  Merge into…
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Expense history */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recent expenses</h3>
              {loadingExpenses ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : expenses && expenses.length > 0 ? (
                <div className="space-y-2">
                  {expenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.description || getCategoryLabel(e.category)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(e.expense_date), 'MMM d, yyyy')} ·{' '}
                          <Badge variant="outline" className="text-[10px]">
                            {getCategoryLabel(e.category)}
                          </Badge>
                        </p>
                      </div>
                      <p className="font-semibold ml-3 shrink-0">
                        {formatCurrency(Number(e.amount), e.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No expenses recorded for this vendor yet.</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes <strong>{vendor.name}</strong>. Existing expenses will keep their vendor name as text but
              will no longer be linked to a vendor record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MergeVendorsDialog
        open={showMerge}
        onOpenChange={setShowMerge}
        source={vendor}
        onMerged={() => onOpenChange(false)}
      />
    </>
  );
}
