import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteBusinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteBusinessDialog({
  open,
  onOpenChange,
  businessName,
  onConfirm,
  isPending,
}: DeleteBusinessDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const isMatch = confirmText === businessName;

  const handleOpenChange = (value: boolean) => {
    if (!value) setConfirmText('');
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Business
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-2">
            <p className="font-medium text-destructive">The following will be permanently deleted:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>All clients associated with this business</li>
              <li>All expense records</li>
              <li>Team memberships</li>
              <li>Subscription data</li>
              <li>Notifications</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-semibold text-foreground">"{businessName}"</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={businessName}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!isMatch || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {isPending ? 'Deleting...' : 'Delete Business'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
