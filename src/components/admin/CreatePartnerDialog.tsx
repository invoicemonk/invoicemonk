import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePartner } from '@/hooks/use-admin-partners';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreatePartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePartnerDialog({ open, onOpenChange }: CreatePartnerDialogProps) {
  const createPartner = useCreatePartner();
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rate, setRate] = useState('20');

  const handleCreate = async () => {
    if (!userId.trim() || !name.trim() || !email.trim()) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    try {
      await createPartner.mutateAsync({
        user_id: userId.trim(),
        name: name.trim(),
        email: email.trim(),
        commission_rate: Number(rate) / 100,
      });
      toast({ title: 'Partner created successfully' });
      onOpenChange(false);
      setUserId('');
      setName('');
      setEmail('');
      setRate('20');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Partner</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              placeholder="UUID of the existing user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">The user must already have an account.</p>
          </div>
          <div className="space-y-2">
            <Label>Partner Name</Label>
            <Input
              placeholder="e.g. John Agency"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="partner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Commission Rate (%)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} disabled={createPartner.isPending} className="w-full">
            {createPartner.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create Partner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
