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
  Mail
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusiness } from '@/contexts/BusinessContext';
import { useRegionalPricing } from '@/hooks/use-regional-pricing';
import { useCheckout } from '@/hooks/use-checkout';
import { gaEvents } from '@/hooks/use-google-analytics';
import { useTierFeatures } from '@/hooks/use-tier-features';

const planIcons = {
  starter: Zap,
  professional: Shield,
  business: Building2,
};

type TierKey = 'starter' | 'professional' | 'business';

const TIER_DISPLAY: Record<TierKey | 'biz', { name: string; description: string }> = {
  starter: { name: 'Starter', description: 'For individuals getting started' },
  professional: { name: 'Pro', description: 'For growing businesses' },
  business: { name: 'SME', description: 'For scaling companies' },
  biz: { name: 'Biz', description: 'Enterprise with e-invoicing & compliance' },
};

const BIZ_FEATURES = [
  'Everything in SME',
  'E-invoicing & government submission',
  'Dedicated account manager',
  'Custom integrations',
  'SLA guarantee',
  'Unlimited everything',
  'Priority support',
];

export default function Billing() {
  const { tier, subscription, currentBusiness, loading: businessLoading } = useBusiness();
  const { pricingByTier, formatPrice, isLoading: pricingLoading } = useRegionalPricing();
  const { createCheckoutSession, openCustomerPortal, isLoading: checkoutLoading } = useCheckout();
  const { buildFeatureList, isLoading: tierFeaturesLoading } = useTierFeatures();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  useEffect(() => {
    gaEvents.subscriptionViewed(tier);
  }, [tier]);

  const handleUpgrade = async (newTier: TierKey) => {
    if (newTier === 'starter') return;
    setLoadingTier(newTier);
    await createCheckoutSession(newTier as 'professional' | 'business', isYearly ? 'yearly' : 'monthly', currentBusiness?.id);
    setLoadingTier(null);
  };

  const handleManageSubscription = async () => {
    await openCustomerPortal();
  };

  const tiers: TierKey[] = ['starter', 'professional', 'business'];
  
  const hasPaidSubscription = subscription?.stripe_subscription_id != null;

  const isLoadingData = pricingLoading || tierFeaturesLoading || businessLoading;

  const isUpgrade = (targetTier: TierKey): boolean => {
    const tierOrder: Record<TierKey, number> = { starter: 0, professional: 1, business: 2 };
    return tierOrder[targetTier] > tierOrder[tier as TierKey];
  };

  const isDowngrade = (targetTier: TierKey): boolean => {
    const tierOrder: Record<TierKey, number> = { starter: 0, professional: 1, business: 2 };
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
                <h3 className="text-xl font-bold">{TIER_DISPLAY[tier as TierKey]?.name ?? tier}</h3>
                <Badge>Current</Badge>
              </div>
              <p className="text-muted-foreground">
                {TIER_DISPLAY[tier as TierKey]?.description ?? ''}
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
          <Badge variant="secondary" className="ml-2">Save ~17%</Badge>
        </Label>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((planTier) => {
            const isCurrent = planTier === tier;
            const isUpgradeTier = isUpgrade(planTier);
            const isDowngradeTier = isDowngrade(planTier);
            const Icon = planIcons[planTier];
            const isRecommended = planTier === 'professional';
            const pricing = pricingByTier[planTier];
            const isLoadingThis = loadingTier === planTier;
            const display = TIER_DISPLAY[planTier];
            const features = buildFeatureList(planTier);

            const price = pricing 
              ? (isYearly && pricing.yearly_price 
                  ? pricing.yearly_price / 12
                  : pricing.monthly_price)
              : 0;

            const showPriceSkeleton = isLoadingData && planTier !== 'starter' && !pricing;

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
                    {display.name}
                  </CardTitle>
                  <CardDescription>{display.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">
                      {showPriceSkeleton ? (
                        <Skeleton className="h-9 w-24 inline-block" />
                      ) : (
                        formatPrice(price)
                      )}
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

          {/* Biz (Contact Sales) Card */}
          <Card className="relative border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {TIER_DISPLAY.biz.name}
              </CardTitle>
              <CardDescription>{TIER_DISPLAY.biz.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">Custom</span>
                <span className="text-muted-foreground ml-1">pricing</span>
              </div>
              
              <Separator />
              
              <ul className="space-y-2">
                {BIZ_FEATURES.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <Button className="w-full" variant="outline" asChild>
                <a href="mailto:sales@invoicemonk.com">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Sales
                </a>
              </Button>
            </CardContent>
          </Card>
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
