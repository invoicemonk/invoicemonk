import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/contexts/BusinessContext';

export function OnlinePaymentsBanner() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  const storageKey = businessId ? `online-payments-banner-dismissed-${businessId}` : null;

  const [dismissed, setDismissed] = useState(true); // default true to avoid flash

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(storageKey) === 'true');
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) localStorage.setItem(storageKey, 'true');
  };

  if (dismissed || !businessId) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-foreground">
              Accept payments online
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              New
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your clients can now pay invoices instantly via card. Online payments are enabled by default.
          </p>
          <Button variant="link" className="h-auto p-0 mt-2 text-sm" asChild>
            <Link to={`/b/${businessId}/settings`}>
              Manage in Settings <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md hover:bg-primary/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
