import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateVendor } from '@/hooks/use-vendors';
import { useBusiness } from '@/contexts/BusinessContext';
import { INPUT_LIMITS } from '@/lib/input-limits';

export function AddVendorDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [notes, setNotes] = useState('');
  const { currentBusiness } = useBusiness();
  const createVendor = useCreateVendor();

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setTaxId('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness?.id || !name.trim()) return;
    await createVendor.mutateAsync({
      business_id: currentBusiness.id,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      tax_id: taxId.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Vendor</DialogTitle>
            <DialogDescription>
              Create a new vendor record. You can link expenses to it from the expense form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Name *</Label>
              <Input
                id="vendor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AWS, Office Depot"
                maxLength={INPUT_LIMITS.SHORT_TEXT}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@vendor.com"
                  maxLength={INPUT_LIMITS.EMAIL}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 0100"
                  maxLength={INPUT_LIMITS.PHONE}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-tax">Tax ID</Label>
              <Input
                id="vendor-tax"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="Optional"
                maxLength={INPUT_LIMITS.TAX_ID}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Textarea
                id="vendor-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything you want to remember about this vendor"
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createVendor.isPending}>
              {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
