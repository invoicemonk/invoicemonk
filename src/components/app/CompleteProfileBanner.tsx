import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/contexts/BusinessContext';

interface MissingField {
  label: string;
  reason: string;
}

const FIELD_REASONS: Record<string, MissingField> = {
  country: { label: 'Country', reason: 'Determines your tax rules and required invoice fields' },
  currency: { label: 'Currency', reason: 'Must appear on every invoice for legal validity' },
  email: { label: 'Contact Email', reason: 'Required as the issuer contact on invoices' },
  taxId: { label: 'Tax ID', reason: 'Required on B2B invoices in most jurisdictions' },
  legalName: { label: 'Legal Name', reason: 'Must match your official registration for compliance' },
};

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

  const missingItems: MissingField[] = [];

  if (!currentBusiness.jurisdiction) {
    missingItems.push(FIELD_REASONS.country);
  }
  if (!currentBusiness.default_currency) {
    missingItems.push(FIELD_REASONS.currency);
  }
  if (!currentBusiness.contact_email) {
    missingItems.push(FIELD_REASONS.email);
  }
  if (business.registration_status === 'registered' && !currentBusiness.tax_id) {
    missingItems.push(FIELD_REASONS.taxId);
  }
  if (business.registration_status === 'registered' && !currentBusiness.legal_name) {
    missingItems.push(FIELD_REASONS.legalName);
  }

  if (missingItems.length === 0) return null;

  const settingsUrl = `/b/${currentBusiness.id}/settings`;

  return (
    <Alert className={className} variant="default">
      <Building2 className="h-4 w-4" />
      <AlertTitle className="font-medium">Complete your business profile for compliant invoicing</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <ul className="space-y-1.5">
          {missingItems.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground"> — {item.reason}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to={settingsUrl}>
              Complete Profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Have your tax registration number and business address ready
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
