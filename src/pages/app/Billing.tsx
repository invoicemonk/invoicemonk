import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Check,
  Zap,
  Building2,
  Shield,
  ExternalLink,
  Loader2,
  Sparkles,
  Star
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useBusiness, type SubscriptionTier as BusinessTier } from '@/contexts/BusinessContext';
import { useRegionalPricing } from '@/hooks/use-regional-pricing';
import { useCheckout } from '@/hooks/use-checkout';
import { gaEvents } from '@/hooks/use-google-analytics';

// Feature lists by tier - different for Nigeria vs International
const planFeaturesNigeria = {
  starter: [
    '5 invoices per month',
    'Clean invoice layout',
    'Subtle Invoicemonk branding',
    'View invoice online',
    '7-year data retention',
  ],
  starter_paid: [
    'Unlimited invoices',
    'PDF export',
    'Branded invoices',
    'Basic compliance fields',
    '7-year retention',
  ],
  professional: [
    'Everything in Starter',
    'Full audit trail',
    'Immutable invoice hashes',
    'Public invoice verification',
    'Compliance-ready exports',
    'Priority support',
  ],
  business: [
    'Everything in Professional',
    'Multi-user accounts',
    'Roles & permissions',
    'Bulk invoicing',
    'SLA support',
    'API access (coming soon)',
  ],
};

const planFeaturesInternational = {
  starter: [
    '5 invoices per month',
    'Basic compliance features',
    'Email support',
    'Single user',
  ],
  professional: [
    'Unlimited invoices',
    'Full compliance suite',
    'Priority support',
    'Up to 5 team members',
    'Custom branding',
    'Audit exports',
  ],
  business: [
    'Everything in Professional',
    'Unlimited team members',
    'API access (Coming Soon)',
    'Dedicated account manager',
    'Custom integrations',
    'SLA guarantee',
  ],
};

const planIcons = {
  starter: Zap,
  starter_paid: Star,
  professional: Shield,
  business: Building2,
};

type TierKey = 'starter' | 'starter_paid' | 'professional' | 'business';

export default function Billing() {
  const { tier, subscription, currentBusiness, loading: businessLoading } = useBusiness();
  const { pricingByTier, formatPrice, isLoading: pricingLoading, isNigeria, hasStarterPaidTier } = useRegionalPricing();
  const { createCheckoutSession, openCustomerPortal, isLoading: checkoutLoading } = useCheckout();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  useEffect(() => {
    gaEvents.subscriptionViewed(tier);
  }, [tier]);

  const handleUpgrade = async (newTier: TierKey) => {
    if (newTier === 'starter') return;
    setLoadingTier(newTier);
    // Pass businessId to checkout
    await createCheckoutSession(newTier as 'starter_paid' | 'professional' | 'business', isYearly ? 'yearly' : 'monthly', currentBusiness?.id);
    setLoadingTier(null);
  };

  const handleManageSubscription = async () => {
    await openCustomerPortal();
  };

  // Nigeria sees 4 tiers, International sees 3 tiers
  const tiers: TierKey[] = isNigeria && hasStarterPaidTier
    ? ['starter', 'starter_paid', 'professional', 'business']
    : ['starter', 'professional', 'business'];
  
  const planFeatures = isNigeria ? planFeaturesNigeria : planFeaturesInternational;
  const hasPaidSubscription = subscription?.stripe_subscription_id != null;

  const getTierDisplayName = (t: TierKey) => {
    if (t === 'starter') return 'Free';
    if (t === 'starter_paid') return 'Starter';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const getTierDescription = (t: TierKey) => {
    switch (t) {
      case 'starter': return 'For individuals getting started';
      case 'starter_paid': return 'For solo businesses ready to grow';
      case 'professional': return 'For growing businesses';
      case 'business': return 'For enterprises with advanced needs';
      default: return '';
    }
  };

  // Determine if a tier is an upgrade from current
  const isUpgrade = (targetTier: TierKey): boolean => {
    const tierOrder: Record<TierKey, number> = { starter: 0, starter_paid: 1, professional: 2, business: 3 };
    return tierOrder[targetTier] > tierOrder[tier as TierKey];
  };

  const isDowngrade = (targetTier: TierKey): boolean => {
    const tierOrder: Record<TierKey, number> = { starter: 0, starter_paid: 1, professional: 2, business: 3 };
    return tierOrder[targetTier] < tierOrder[tier as TierKey];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing details
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan {currentBusiness && <span className="text-muted-foreground font-normal text-sm">for {currentBusiness.name}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{getTierDisplayName(tier as TierKey)}</h3>
                <Badge>Current</Badge>
              </div>
              <p className="text-muted-foreground">
                {getTierDescription(tier as TierKey)}
              </p>
              {subscription?.current_period_end && tier !== 'starter' && (
                <p className="text-sm text-muted-foreground mt-2">
                  Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="text-right">
              {pricingByTier[tier as TierKey] && (
                <div className="text-2xl font-bold">
                  {formatPrice(pricingByTier[tier as TierKey]!.monthly_price)}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </div>
              )}
              {hasPaidSubscription && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleManageSubscription}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : 'text-muted-foreground'}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : 'text-muted-foreground'}>
          Yearly
          <Badge variant="secondary" className="ml-2">Save 20%</Badge>
        </Label>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className={`grid gap-4 ${tiers.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {tiers.map((planTier) => {
            const isCurrent = planTier === tier;
            const isUpgradeTier = isUpgrade(planTier);
            const isDowngradeTier = isDowngrade(planTier);
            const Icon = planIcons[planTier];
            const isRecommended = planTier === 'professional';
            const pricing = pricingByTier[planTier];
            const isLoadingThis = loadingTier === planTier;
            const features = planFeatures[planTier as keyof typeof planFeatures] || [];

            const price = pricing 
              ? (isYearly && pricing.yearly_price 
                  ? pricing.yearly_price / 12
                  : pricing.monthly_price)
              : 0;

            return (
              <Card 
                key={planTier} 
                className={`relative ${isRecommended ? 'border-primary shadow-lg' : ''} ${isCurrent ? 'bg-muted/30' : ''}`}
              >
                {isRecommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Recommended
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {getTierDisplayName(planTier)}
                  </CardTitle>
                  <CardDescription>
                    {getTierDescription(planTier)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">
                      {pricingLoading ? '...' : formatPrice(price)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                    {isYearly && planTier !== 'starter' && pricing?.yearly_price && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed {formatPrice(pricing.yearly_price)} yearly
                      </p>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <ul className="space-y-2">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {isCurrent ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Current Plan
                    </Button>
                  ) : isUpgradeTier ? (
                    <Button 
                      className="w-full" 
                      variant={isRecommended ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(planTier)}
                      disabled={checkoutLoading || !!loadingTier}
                    >
                      {isLoadingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Upgrade'
                      )}
                    </Button>
                  ) : isDowngradeTier ? (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={handleManageSubscription}
                      disabled={checkoutLoading || !hasPaidSubscription}
                    >
                      {checkoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Downgrade'
                      )}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>
                      Not Available
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing Management</CardTitle>
          <CardDescription>Manage your payment methods and view invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {hasPaidSubscription ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                View your payment history, update payment methods, and download invoices from the Stripe Customer Portal.
              </p>
              <Button 
                onClick={handleManageSubscription}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Open Customer Portal
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No payment history</h3>
              <p className="text-sm text-muted-foreground">
                Upgrade to a paid plan to access billing management features.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}