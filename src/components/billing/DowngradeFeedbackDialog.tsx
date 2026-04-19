import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface DowngradeFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousTier: string;
  newTier: string;
}

const REASONS = [
  { value: 'too_expensive', label: 'Too expensive for me right now' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'not_using_enough', label: "I wasn't using it enough" },
  { value: 'switching_competitor', label: 'Switching to a different tool' },
  { value: 'business_changed', label: 'My business situation changed' },
  { value: 'other', label: 'Other' },
];

export function DowngradeFeedbackDialog({
  open,
  onOpenChange,
  previousTier,
  newTier,
}: DowngradeFeedbackDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (finalReason: string, finalDetails: string) => {
    if (!user?.id) return;
    setSubmitting(true);
    const { error } = await supabase.from('churn_feedback').insert({
      user_id: user.id,
      previous_tier: previousTier,
      new_tier: newTier,
      reason: finalReason,
      details: finalDetails || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Could not save your feedback. Please try again.');
      return;
    }
    if (finalReason !== 'dismissed') {
      toast.success('Thank you — your feedback helps us improve.');
    }
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!reason) {
      toast.error('Please select a reason.');
      return;
    }
    submit(reason, details);
  };

  const handleSkip = () => {
    submit('dismissed', '');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sorry to see you downgrade</DialogTitle>
          <DialogDescription>
            Could you share why? Your honest answer helps us improve for everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-2">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value} className="font-normal cursor-pointer">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div>
            <Label htmlFor="details" className="text-sm">
              Anything else you'd like to share? (optional)
            </Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us more..."
              className="mt-1"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={submitting}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
