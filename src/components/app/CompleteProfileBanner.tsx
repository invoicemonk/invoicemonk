import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/contexts/BusinessContext';

interface CompleteProfileBannerProps {
  className?: string;
}

export function CompleteProfileBanner({ className }: CompleteProfileBannerProps) {
  const { currentBusiness } = useBusiness();

  if (!currentBusiness) return null;

  const business = currentBusiness as typeof currentBusiness & {
    registration_status?: string;
    is_default?: boolean;
  };

  const missingItems: string[] = [];

  // Check for missing essential data
  if (!currentBusiness.jurisdiction) {
    missingItems.push('country');
  }
  if (!currentBusiness.default_currency) {
    missingItems.push('currency');
  }
  if (!currentBusiness.contact_email) {
    missingItems.push('email');
  }
  if (business.registration_status === 'registered' && !currentBusiness.tax_id) {
    missingItems.push('tax ID');
  }
  if (business.registration_status === 'registered' && !currentBusiness.legal_name) {
    missingItems.push('legal name');
  }

  if (missingItems.length === 0) return null;

  const settingsUrl = `/b/${currentBusiness.id}/settings`;

  return (
    <Alert className={className} variant="default">
      <Building2 className="h-4 w-4" />
      <AlertTitle className="font-medium">Complete your business profile</AlertTitle>
      <AlertDescription className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          Add your {missingItems.join(', ')} to issue compliant invoices.
        </span>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to={settingsUrl}>
            Complete Profile
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
