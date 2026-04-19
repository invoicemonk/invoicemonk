import { useState } from 'react';
import { Loader2, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useVendors, useMergeVendors, type Vendor } from '@/hooks/use-vendors';
import { useBusiness } from '@/contexts/BusinessContext';

interface MergeVendorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Vendor | null;
  onMerged?: () => void;
}

export function MergeVendorsDialog({ open, onOpenChange, source, onMerged }: MergeVendorsDialogProps) {
  const { currentBusiness } = useBusiness();
  const { data: vendors = [] } = useVendors(currentBusiness?.id);
  const [targetId, setTargetId] = useState<string>('');
  const merge = useMergeVendors();

  const candidates = vendors.filter((v) => v.id !== source?.id);
  const target = candidates.find((v) => v.id === targetId);

  const handleConfirm = async () => {
    if (!source || !target) return;
    await merge.mutateAsync({
      source_id: source.id,
      target_id: target.id,
      target_name: target.name,
    });
    setTargetId('');
    onOpenChange(false);
    onMerged?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTargetId('');
      }}
    >
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Merge vendor</DialogTitle>
          <DialogDescription>
            All expenses linked to <strong>{source?.name}</strong> will be re-pointed to the target vendor.
            This action can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Merge into</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a vendor to merge into..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    No other vendors to merge into.
                  </div>
                ) : (
                  candidates.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {target && source && (
            <Alert>
              <AlertDescription className="text-sm">
                After merging, <strong>{source.name}</strong> will be deleted and all its expenses will appear under <strong>{target.name}</strong>.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!target || merge.isPending}>
            {merge.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Merge className="h-4 w-4 mr-2" />
            )}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
