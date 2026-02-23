import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronDown, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { JURISDICTION_CONFIG } from '@/lib/jurisdiction-config';
import { getCountryName } from '@/lib/countries';

type ItemStatus = 'complete' | 'missing' | 'not_applicable' | 'warning';

interface ComplianceItem {
  key: string;
  label: string;
  weight: number;
  isApplicable: boolean;
  isComplete: boolean;
  status: ItemStatus;
  statusLabel: string;
  missingAction?: string;
  href: string;
}

function useComplianceItems(): ComplianceItem[] {
  const { currentBusiness, hasTier } = useBusiness();
  const { currentCurrencyAccount } = useCurrencyAccount();
  const { data: paymentMethods = [] } = usePaymentMethods(currentCurrencyAccount?.id);

  return useMemo(() => {
    if (!currentBusiness) return [];

    const businessId = currentBusiness.id;
    const settingsHref = `/b/${businessId}/settings`;
    const jurisdiction = currentBusiness.jurisdiction;
    const config = jurisdiction ? JURISDICTION_CONFIG[jurisdiction] : null;
    const showVat = config?.showVat ?? false;

    const address = currentBusiness.address as Record<string, string> | null;
    const hasAddress = !!(address?.city && address?.country);

    const items: ComplianceItem[] = [
      {
        key: 'name',
        label: 'Business Name',
        weight: 15,
        isApplicable: true,
        isComplete: !!currentBusiness.name,
        status: currentBusiness.name ? 'complete' : 'missing',
        statusLabel: currentBusiness.name || 'Not set',
        missingAction: 'Add your business name',
        href: settingsHref,
      },
      {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        weight: 20,
        isApplicable: true,
        isComplete: !!jurisdiction,
        status: jurisdiction ? 'complete' : 'missing',
        statusLabel: jurisdiction ? getCountryName(jurisdiction) : 'Not selected',
        missingAction: 'Select your business country',
        href: settingsHref,
      },
      {
        key: 'address',
        label: 'Business Address',
        weight: 10,
        isApplicable: true,
        isComplete: hasAddress,
        status: hasAddress ? 'complete' : 'missing',
        statusLabel: hasAddress ? 'Complete' : 'Incomplete',
        missingAction: 'Complete business address',
        href: settingsHref,
      },
      {
        key: 'tax_id',
        label: config?.taxIdLabel || 'Tax ID',
        weight: 15,
        isApplicable: true,
        isComplete: !!currentBusiness.tax_id,
        status: currentBusiness.tax_id ? 'complete' : 'missing',
        statusLabel: currentBusiness.tax_id ? 'Configured' : 'Not set',
        missingAction: `Add your ${config?.taxIdLabel || 'Tax ID'}`,
        href: settingsHref,
      },
      // VAT — conditionally applicable
      {
        key: 'vat',
        label: config?.vatLabel || 'VAT Registration',
        weight: 10,
        isApplicable: showVat,
        isComplete: showVat
          ? !!(currentBusiness.is_vat_registered && currentBusiness.vat_registration_number)
          : false,
        status: !showVat
          ? 'not_applicable'
          : currentBusiness.is_vat_registered && currentBusiness.vat_registration_number
            ? 'complete'
            : currentBusiness.is_vat_registered && !currentBusiness.vat_registration_number
              ? 'warning'
              : 'not_applicable',
        statusLabel: !showVat
          ? 'Not applicable in your jurisdiction'
          : currentBusiness.is_vat_registered && currentBusiness.vat_registration_number
            ? `Registered — ${currentBusiness.vat_registration_number}`
            : currentBusiness.is_vat_registered && !currentBusiness.vat_registration_number
              ? 'VAT enabled but registration number missing'
              : 'Not registered',
        missingAction: showVat && currentBusiness.is_vat_registered && !currentBusiness.vat_registration_number
          ? 'Add VAT registration number'
          : undefined,
        href: settingsHref,
      },
      {
        key: 'prefix',
        label: 'Invoice Prefix',
        weight: 5,
        isApplicable: true,
        isComplete: !!currentBusiness.invoice_prefix,
        status: currentBusiness.invoice_prefix ? 'complete' : 'missing',
        statusLabel: currentBusiness.invoice_prefix || 'Not set',
        missingAction: 'Customize invoice prefix',
        href: settingsHref,
      },
      {
        key: 'payment',
        label: 'Payment Methods',
        weight: 20,
        isApplicable: true,
        isComplete: paymentMethods.length > 0,
        status: paymentMethods.length > 0 ? 'complete' : 'missing',
        statusLabel: paymentMethods.length > 0
          ? `${paymentMethods.length} configured`
          : 'None configured',
        missingAction: 'Add at least one payment method',
        href: settingsHref,
      },
      {
        key: 'audit',
        label: 'Audit Logs',
        weight: 5,
        isApplicable: true,
        isComplete: hasTier('professional'),
        status: hasTier('professional') ? 'complete' : 'warning',
        statusLabel: hasTier('professional') ? 'Enabled' : 'Requires Professional plan',
        href: `/b/${businessId}/billing`,
      },
    ];

    return items;
  }, [currentBusiness, paymentMethods.length, hasTier]);
}

function StatusDot({ status }: { status: ItemStatus }) {
  const colors: Record<ItemStatus, string> = {
    complete: 'bg-green-500',
    missing: 'bg-destructive',
    not_applicable: 'bg-muted-foreground/40',
    warning: 'bg-amber-500',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${colors[status]}`} />;
}

export function ComplianceConfidenceCard() {
  const { currentBusiness } = useBusiness();
  const items = useComplianceItems();

  const { score, earnedPoints, totalApplicablePoints } = useMemo(() => {
    const applicable = items.filter(i => i.isApplicable);
    const total = applicable.reduce((sum, i) => sum + i.weight, 0);
    const earned = applicable.filter(i => i.isComplete).reduce((sum, i) => sum + i.weight, 0);
    return {
      score: total > 0 ? Math.round((earned / total) * 100) : 0,
      earnedPoints: earned,
      totalApplicablePoints: total,
    };
  }, [items]);

  const missingItems = useMemo(
    () => items.filter(i => i.isApplicable && !i.isComplete && i.missingAction),
    [items]
  );

  if (!currentBusiness || items.length === 0) return null;

  // Compact variant when compliance is 100%
  if (score === 100 && missingItems.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Compliance Infrastructure Complete — 100%
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressClassName = `h-2 ${score >= 80 ? '[&>div]:bg-green-500' : score >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-destructive'}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Your Compliance Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score & Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{score}% Compliance Infrastructure Complete</span>
            <span className="text-muted-foreground">{earnedPoints}/{totalApplicablePoints} pts</span>
          </div>
          <Progress value={score} className={progressClassName} />
        </div>

        {/* Item List */}
        <div className="grid gap-1.5">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-2.5 text-sm py-1">
              <StatusDot status={item.status} />
              <span className="font-medium min-w-[130px]">{item.label}</span>
              <span className="text-muted-foreground truncate">{item.statusLabel}</span>
            </div>
          ))}
        </div>

        {/* What's Missing — Collapsible */}
        {missingItems.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline">
              <ChevronDown className="h-4 w-4" />
              What's Missing? ({missingItems.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {missingItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.href}
                  className="flex items-center gap-2 text-sm p-2 rounded-md border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <StatusDot status="missing" />
                  <span className="flex-1">{item.missingAction}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* CTA */}
        {score < 100 && (
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link to={`/b/${currentBusiness.id}/settings`}>
              Complete Compliance Setup
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
