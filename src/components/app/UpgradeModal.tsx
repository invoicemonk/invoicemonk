import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, BarChart3, Palette, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUpgradeTriggers } from '@/hooks/use-upgrade-triggers';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const BENEFITS = [
  { icon: Sparkles, label: 'Unlimited invoices — no monthly caps' },
  { icon: Shield, label: 'Full audit trail & compliance records' },
  { icon: BarChart3, label: 'Advanced reports & revenue analytics' },
  { icon: Palette, label: 'Custom branding on every invoice' },
  { icon: Download, label: 'Data exports (CSV & PDF)' },
];

export function UpgradeModal() {
  const { showUpgradeModal, dismiss } = useUpgradeTriggers();
  const { currentBusiness } = useBusiness();
  const { user } = useAuth();
  const loggedRef = useRef(false);

  const billingPath = currentBusiness
    ? `/b/${currentBusiness.id}/billing`
    : '/billing';

  useEffect(() => {
    if (showUpgradeModal && user?.id && !loggedRef.current) {
      loggedRef.current = true;
      supabase
        .from('lifecycle_events')
        .insert({
          user_id: user.id,
          event_type: 'upgrade_modal_shown',
          metadata: { trigger: 'second_invoice' },
        })
        .then(({ error }) => {
          if (error) console.error('Failed to log upgrade_modal_shown:', error);
        });
    }
  }, [showUpgradeModal, user?.id]);

  if (!showUpgradeModal) return null;

  return (
    <Dialog open={showUpgradeModal} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 mb-3 p-2.5 rounded-full bg-primary/10 w-fit">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle>Upgrade to Professional</DialogTitle>
          <DialogDescription>
            You're growing fast! Unlock unlimited invoicing and full compliance features.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 py-2">
          {BENEFITS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={dismiss} className="sm:order-1">
            Maybe Later
          </Button>
          <Button asChild className="sm:order-2">
            <Link to={billingPath} onClick={dismiss}>
              Upgrade Now
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
