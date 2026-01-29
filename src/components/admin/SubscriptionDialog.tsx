import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useAdminUpdateSubscription } from '@/hooks/use-admin';
import { Database } from '@/integrations/supabase/types';

type SubscriptionTier = Database['public']['Enums']['subscription_tier'];
type SubscriptionStatus = Database['public']['Enums']['subscription_status'];

interface BusinessData {
  id: string;
  name: string;
  subscriptions?: { id?: string; tier: string; status: string }[];
}

interface SubscriptionDialogProps {
  business: BusinessData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIERS: { value: SubscriptionTier; label: string; description: string }[] = [
  { value: 'starter', label: 'Starter', description: 'Basic features, limited invoices' },
  { value: 'professional', label: 'Professional', description: 'More invoices, custom branding' },
  { value: 'business', label: 'Business', description: 'Unlimited invoices, priority support' },
];

const STATUSES: { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function SubscriptionDialog({ business, open, onOpenChange }: SubscriptionDialogProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | ''>('');
  const [reason, setReason] = useState('');
  const updateSubscription = useAdminUpdateSubscription();

  const currentSubscription = business?.subscriptions?.[0];
  const currentTier = currentSubscription?.tier || 'starter';
  const currentStatus = currentSubscription?.status || 'active';

  const handleSubmit = async () => {
    if (!business || !currentSubscription) return;

    const subscriptionId = (currentSubscription as any).id;
    if (!subscriptionId) {
      console.error('No subscription ID found');
      return;
    }

    const updates: { tier?: SubscriptionTier; status?: SubscriptionStatus } = {};
    if (selectedTier && selectedTier !== currentTier) {
      updates.tier = selectedTier;
    }
    if (selectedStatus && selectedStatus !== currentStatus) {
      updates.status = selectedStatus;
    }

    if (Object.keys(updates).length === 0) return;

    await updateSubscription.mutateAsync({
      subscriptionId,
      updates,
      reason: reason.trim(),
    });

    setSelectedTier('');
    setSelectedStatus('');
    setReason('');
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedTier('');
      setSelectedStatus('');
      setReason('');
    }
    onOpenChange(newOpen);
  };

  if (!business) return null;

  const hasChanges = (selectedTier && selectedTier !== currentTier) || 
                     (selectedStatus && selectedStatus !== currentStatus);
  const isValid = hasChanges && reason.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Manage Subscription
          </DialogTitle>
          <DialogDescription>
            Update subscription for {business.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">
                Subscription changes are logged and flagged for audit review. A detailed reason is mandatory.
              </p>
            </div>
          </div>

          {/* Current Status */}
          <div className="space-y-2">
            <Label>Current Subscription</Label>
            <div className="p-3 bg-muted rounded-md flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{currentTier}</Badge>
              <span className="text-muted-foreground">•</span>
              <Badge 
                variant={currentStatus === 'active' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {currentStatus}
              </Badge>
            </div>
          </div>

          {/* New Tier */}
          <div className="space-y-2">
            <Label htmlFor="tier">New Tier (optional)</Label>
            <Select value={selectedTier} onValueChange={(value) => setSelectedTier(value as SubscriptionTier)}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current tier" />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((tier) => (
                  <SelectItem 
                    key={tier.value} 
                    value={tier.value}
                    disabled={tier.value === currentTier}
                  >
                    <div className="flex flex-col">
                      <span>{tier.label}</span>
                      <span className="text-xs text-muted-foreground">{tier.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label htmlFor="status">New Status (optional)</Label>
            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as SubscriptionStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem 
                    key={status.value} 
                    value={status.value}
                    disabled={status.value === currentStatus}
                  >
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this subscription change is necessary (minimum 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 characters minimum
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || updateSubscription.isPending}
          >
            {updateSubscription.isPending ? 'Updating...' : 'Update Subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
