import { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Check, Shield, Building2, Loader2, ArrowRight, Sparkles, Mail,
  AlertTriangle, RotateCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useRegionalPricing } from '@/hooks/use-regional-pricing';
import { useCheckout } from '@/hooks/use-checkout';
import { useSubscription } from '@/hooks/use-subscription';
import { useTierFeatures } from '@/hooks/use-tier-features';
import logoImage from '@/assets/invoicemonk-logo.png';
import { addTags } from '@/lib/onesignal';
import { trackFunnel } from '@/lib/funnel-tracking';

type TierKey = 'professional' | 'business';

// Hardcoded fallback pricing (USD, in cents) — used if network slow.
// Authoritative pricing is always re-validated server-side at checkout.
const FALLBACK_PRICING: Record<TierKey, { monthly: number; yearly: number }> = {
  professional: { monthly: 1900, yearly: 19000 },
  business: { monthly: 4900, yearly: 49000 },
};

const FALLBACK_FEATURES: Record<TierKey, string[]> = {
  professional: ['Unlimited invoices', 'Unlimited receipts', 'Up to 3 team members', 'Accounting module', 'Expense tracking', 'Credit notes', 'Data exports'],
  business: ['Unlimited everything', 'Unlimited team members', 'Full audit trail', 'In-app support', 'Custom branding', 'Credit notes', 'Data exports'],
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

const TIER_DISPLAY: Record<TierKey | 'biz', { name: string; description: string }> = {
  professional: { name: 'Pro', description: 'For growing businesses' },
  business: { name: 'SME', description: 'For scaling companies' },
  biz: { name: 'Biz', description: 'Enterprise with e-invoicing & compliance' },
};

const planIcons: Record<TierKey, typeof Shield> = {
  professional: Shield,
  business: Building2,
};

function fallbackFormatPrice(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

export default function PlanSelection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [searchParams] = useSearchParams();

  const { pricingByTier, formatPrice, isLoading: pricingLoading } = useRegionalPricing();
  const { createCheckoutSession, isLoading: checkoutLoading } = useCheckout();
  const { subscription } = useSubscription();
  const { buildFeatureList, isLoading: tierFeaturesLoading } = useTierFeatures();
  const queryClient = useQueryClient();

  // Fetch the user's pending paid intent (if any) so we can show the resume banner.
  const { data: intent } = useQuery({
    queryKey: ['paid-intent', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('intended_tier, intended_billing_period, failed_checkout_attempts')
        .eq('id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const pendingPaidTier = (intent?.intended_tier as TierKey | null) || null;
  const pendingBilling = (intent?.intended_billing_period as 'monthly' | 'yearly' | null) || 'monthly';
  const failedAttempts = intent?.failed_checkout_attempts ?? 0;

  // Page view tracking
  useEffect(() => {
    trackFunnel('onboarding_plan_viewed');
  }, []);

  // Auto-resume: ?resume=1 from recovery email / cancel page → fire checkout immediately.
  useEffect(() => {
    if (searchParams.get('resume') === '1' && pendingPaidTier) {
      trackFunnel('paid_intent_resumed', { tier: pendingPaidTier, source: 'auto' });
      setLoadingTier(pendingPaidTier);
      createCheckoutSession(pendingPaidTier, pendingBilling).finally(() => setLoadingTier(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPaidTier]);

  // Trigger fallback rendering if data is slow
  useEffect(() => {
    if (!pricingLoading && !tierFeaturesLoading) return;
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [pricingLoading, tierFeaturesLoading]);

  const dataReady = !pricingLoading && !tierFeaturesLoading;
  const useFallback = !dataReady && showFallback;

  const handleSelectPlan = async (planTier: TierKey) => {
    trackFunnel('onboarding_plan_selected', {
      plan: planTier,
      billing: isYearly ? 'yearly' : 'monthly',
    });

    addTags({ plan_type: 'paid' });
    // Persist intent BEFORE redirecting to Stripe so a failed checkout can be recovered.
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({
          intended_tier: planTier,
          intended_billing_period: isYearly ? 'yearly' : 'monthly',
          intended_tier_set_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }
    setLoadingTier(planTier);
    await createCheckoutSession(planTier, isYearly ? 'yearly' : 'monthly');
    setLoadingTier(null);
  };

  const handleResumeUpgrade = async () => {
    if (!pendingPaidTier) return;
    trackFunnel('paid_intent_resumed', { tier: pendingPaidTier, source: 'banner' });
    setLoadingTier(pendingPaidTier);
    await createCheckoutSession(pendingPaidTier, pendingBilling);
    setLoadingTier(null);
  };

  const tiers: TierKey[] = ['professional', 'business'];

  // Skeleton-only state: data still loading AND fallback hasn't kicked in yet (<1.5s)
  const showSkeleton = !dataReady && !useFallback;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <img
            src={logoImage}
            alt="Invoicemonk"
            className="h-12 mx-auto mb-6"
          />
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pick a plan to start using InvoiceMonk. Cancel anytime.
          </p>
        </motion.div>

        {pendingPaidTier && failedAttempts > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-3xl mx-auto rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium">
                You started upgrading to {TIER_DISPLAY[pendingPaidTier].name} but the payment didn't go through.
              </p>
              <p className="text-muted-foreground">
                Resume checkout with a different card, or pick another plan below.
              </p>
            </div>
            <Button
              onClick={handleResumeUpgrade}
              disabled={loadingTier !== null}
              className="shrink-0"
            >
              {loadingTier === pendingPaidTier ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4 mr-2" />
              )}
              Resume upgrade
            </Button>
          </motion.div>
        )}

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-4 mb-10"
        >
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
        </motion.div>

        {/* Plan Cards */}
        <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => {
            const pricing = pricingByTier[tier];
            const Icon = planIcons[tier];
            const display = TIER_DISPLAY[tier];
            const isRecommended = tier === 'professional';
            const isCurrent = subscription
              ? tier === subscription.tier
              : false;
            const isLoadingThis = loadingTier === tier;
            const realFeatures = buildFeatureList(tier);
            const features = realFeatures.length > 0 ? realFeatures : FALLBACK_FEATURES[tier];

            // Resolve display price: real → fallback (if timed out) → 0
            let displayPriceCents = 0;
            let yearlyPriceCents: number | null = null;
            if (pricing) {
              displayPriceCents = isYearly && pricing.yearly_price
                ? pricing.yearly_price / 12
                : pricing.monthly_price;
              yearlyPriceCents = pricing.yearly_price;
            } else if (useFallback) {
              const fb = FALLBACK_PRICING[tier];
              displayPriceCents = isYearly ? fb.yearly / 12 : fb.monthly;
              yearlyPriceCents = fb.yearly || null;
            }

            const renderPrice = pricing
              ? formatPrice(displayPriceCents)
              : fallbackFormatPrice(displayPriceCents);
            const renderYearly = pricing && yearlyPriceCents
              ? formatPrice(yearlyPriceCents)
              : yearlyPriceCents != null
                ? fallbackFormatPrice(yearlyPriceCents)
                : null;

            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
              >
                <Card
                  className={`relative h-full flex flex-col ${
                    isRecommended ? 'border-primary shadow-lg scale-105' : ''
                  } ${isCurrent ? 'bg-muted/30' : ''}`}
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
                  <CardContent className="flex-1 flex flex-col">
                    <div className="mb-4">
                      {showSkeleton ? (
                        <Skeleton className="h-10 w-24" />
                      ) : (
                        <>
                          <span className="text-4xl font-bold">{renderPrice}</span>
                          <span className="text-muted-foreground">/month</span>
                          {isYearly && yearlyPriceCents && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Billed {renderYearly} yearly
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <Separator className="mb-4" />

                    <ul className="space-y-3 flex-1">
                      {showSkeleton ? (
                        <>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="h-4 w-4/6" />
                          <Skeleton className="h-4 w-5/6" />
                        </>
                      ) : (
                        features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))
                      )}
                    </ul>

                    <div className="mt-6">
                      {isCurrent ? (
                        <Button className="w-full" variant="secondary" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={isRecommended ? 'default' : 'outline'}
                          onClick={() => handleSelectPlan(tier)}
                          disabled={checkoutLoading || !!loadingTier}
                        >
                          {isLoadingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Get Started
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {/* Biz (Contact Sales) Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="relative h-full flex flex-col border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {TIER_DISPLAY.biz.name}
                </CardTitle>
                <CardDescription>{TIER_DISPLAY.biz.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-4">
                  <span className="text-4xl font-bold">Custom</span>
                  <span className="text-muted-foreground ml-1">pricing</span>
                </div>

                <Separator className="mb-4" />

                <ul className="space-y-3 flex-1">
                  {BIZ_FEATURES.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Button className="w-full" variant="outline" asChild>
                    <a href="mailto:sales@invoicemonk.com">
                      <Mail className="h-4 w-4 mr-2" />
                      Contact Sales
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Need to come back later? You can sign out and finish picking a plan when you're ready.
        </p>
      </div>
    </div>
  );
}
