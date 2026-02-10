import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePayoutBatch, useAdminPartnerCommissions } from '@/hooks/use-admin-partners';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface CreatePayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
}

export function CreatePayoutDialog({ open, onOpenChange, partnerId, partnerName }: CreatePayoutDialogProps) {
  const { data: commissions } = useAdminPartnerCommissions(partnerId);
  const createPayout = useCreatePayoutBatch();

  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedCommIds, setSelectedCommIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');

  // Only locked commissions without a batch
  const eligibleCommissions = commissions?.filter(
    (c) => c.status === 'locked' && !c.payout_batch_id
  ) || [];

  // Unique currencies from eligible commissions
  const currencies = [...new Set(eligibleCommissions.map((c) => c.currency))];

  const filteredCommissions = selectedCurrency
    ? eligibleCommissions.filter((c) => c.currency === selectedCurrency)
    : [];

  const totalAmount = filteredCommissions
    .filter((c) => selectedCommIds.includes(c.id))
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);

  const toggleCommission = (id: string) => {
    setSelectedCommIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedCommIds(filteredCommissions.map((c) => c.id));
  };

  const handleCreate = async () => {
    if (!selectedCurrency || selectedCommIds.length === 0) {
      toast({ title: 'Select currency and at least one commission', variant: 'destructive' });
      return;
    }
    try {
      await createPayout.mutateAsync({
        partner_id: partnerId,
        currency: selectedCurrency,
        commission_ids: selectedCommIds,
        total_amount: totalAmount,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentRef || undefined,
        notes: notes || undefined,
      });
      toast({ title: 'Payout batch created' });
      onOpenChange(false);
      setSelectedCommIds([]);
      setPaymentRef('');
      setNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Payout for {partnerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {eligibleCommissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No locked commissions available for payout.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={selectedCurrency} onValueChange={(val) => { setSelectedCurrency(val); setSelectedCommIds([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredCommissions.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Select Commissions</Label>
                    <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3">
                    {filteredCommissions.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={selectedCommIds.includes(c.id)}
                          onCheckedChange={() => toggleCommission(c.id)}
                        />
                        <span className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                        <span className="font-medium">
                          {Number(c.commission_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {c.currency}
                        </span>
                        <Badge variant="secondary" className="text-xs ml-auto">{c.status}</Badge>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-muted text-sm">
                    <strong>Total: {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedCurrency}</strong>
                    <span className="text-muted-foreground ml-2">({selectedCommIds.length} commissions)</span>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="wise">Wise</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input
                  placeholder="External payment reference"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Internal notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={createPayout.isPending || selectedCommIds.length === 0}
                className="w-full"
              >
                {createPayout.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create Payout Batch
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
