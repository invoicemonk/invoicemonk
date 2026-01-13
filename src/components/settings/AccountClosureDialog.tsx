import { useState } from 'react';
import { AlertTriangle, Check, Clock, Loader2, Lock, Shield } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { RetentionPolicy } from '@/hooks/use-retention-policies';

interface AccountClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retentionPolicies: RetentionPolicy[];
  maxRetentionYears: number;
  jurisdiction: string;
}

const CLOSURE_REASONS = [
  { value: 'no_longer_needed', label: 'No longer need the service' },
  { value: 'switching_provider', label: 'Switching to another provider' },
  { value: 'business_closed', label: 'Business closed down' },
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'privacy_concerns', label: 'Privacy concerns' },
  { value: 'other', label: 'Other reason' },
];

const ENTITY_LABELS: Record<string, string> = {
  invoice: 'Invoices',
  payment: 'Payments',
  credit_note: 'Credit Notes',
  audit_log: 'Audit Logs',
  export_manifest: 'Export Records',
};

export function AccountClosureDialog({
  open,
  onOpenChange,
  retentionPolicies,
  maxRetentionYears,
  jurisdiction,
}: AccountClosureDialogProps) {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [acknowledgeRetention, setAcknowledgeRetention] = useState(false);
  const [acknowledgeDataLoss, setAcknowledgeDataLoss] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [password, setPassword] = useState('');

  const CONFIRMATION_PHRASE = 'CLOSE MY ACCOUNT';
  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const resetForm = () => {
    setStep(1);
    setAcknowledgeRetention(false);
    setAcknowledgeDataLoss(false);
    setClosureReason('');
    setAdditionalFeedback('');
    setConfirmationPhrase('');
    setPassword('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const canProceedStep1 = acknowledgeRetention && acknowledgeDataLoss;
  const canProceedStep2 = !!closureReason;
  const canProceedStep3 = confirmationPhrase === CONFIRMATION_PHRASE;
  const canProceedStep4 = password.length >= 8;

  const handleCloseAccount = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Verify password by re-authenticating
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: password,
      });

      if (authError) {
        toast({
          title: 'Invalid password',
          description: 'Please enter your correct password to proceed.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Call the close_account RPC function
      const { error: closeError } = await supabase.rpc('close_account', {
        _user_id: user.id,
        _reason: `${closureReason}: ${additionalFeedback}`.trim(),
      });

      if (closeError) throw closeError;

      toast({
        title: 'Account closure requested',
        description: 'Your account has been scheduled for closure. You will be logged out.',
      });

      // Sign out the user
      await signOut();
      handleClose();
    } catch (error: any) {
      console.error('Account closure error:', error);
      toast({
        title: 'Error closing account',
        description: error.message || 'Failed to close account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Close Account
          </DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1" />

        <div className="py-4">
          {/* Step 1: Acknowledge Retention */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-brand-600" />
                  <span>Data Retention Requirements</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Due to legal compliance requirements in your jurisdiction ({jurisdiction}), 
                  certain records will be retained for the periods shown below:
                </p>
                <ul className="text-sm space-y-1.5 pl-4">
                  {retentionPolicies.map((policy) => (
                    <li key={policy.id} className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>
                        <strong>{ENTITY_LABELS[policy.entity_type] || policy.entity_type}:</strong>{' '}
                        {policy.retention_years} years
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  After {maxRetentionYears} years, all data will be permanently deleted.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="acknowledge-retention"
                    checked={acknowledgeRetention}
                    onCheckedChange={(checked) => setAcknowledgeRetention(!!checked)}
                  />
                  <Label htmlFor="acknowledge-retention" className="text-sm leading-relaxed cursor-pointer">
                    I understand that my compliance data will be retained for up to {maxRetentionYears} years 
                    as required by law.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="acknowledge-data-loss"
                    checked={acknowledgeDataLoss}
                    onCheckedChange={(checked) => setAcknowledgeDataLoss(!!checked)}
                  />
                  <Label htmlFor="acknowledge-data-loss" className="text-sm leading-relaxed cursor-pointer">
                    I understand that I will immediately lose access to my account, invoices, 
                    clients, and all associated data upon closure.
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Closure Reason */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="closure-reason">Why are you closing your account?</Label>
                <Select value={closureReason} onValueChange={setClosureReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSURE_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-feedback">Additional feedback (optional)</Label>
                <Textarea
                  id="additional-feedback"
                  placeholder="Help us improve by sharing more details..."
                  value={additionalFeedback}
                  onChange={(e) => setAdditionalFeedback(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Type Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive mb-2">
                  This action cannot be undone
                </p>
                <p className="text-sm text-muted-foreground">
                  To confirm, please type <strong>{CONFIRMATION_PHRASE}</strong> below.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation-phrase">Confirmation</Label>
                <Input
                  id="confirmation-phrase"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value.toUpperCase())}
                  placeholder={CONFIRMATION_PHRASE}
                />
                {confirmationPhrase && confirmationPhrase === CONFIRMATION_PHRASE && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="h-3 w-3" />
                    <span>Confirmed</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Password Verification */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Enter your password to complete the account closure</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
          )}
          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3)
              }
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleCloseAccount}
              disabled={!canProceedStep4 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Close My Account'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
