import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Check, 
  Zap, 
  Shield, 
  Building2, 
  Loader2,
  ArrowRight,
  Sparkles,
  Mail
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
type TierKey = 'starter' | 'professional' | 'business';

// Hardcoded fallback pricing (USD, in cents) — used if network slow.
// Authoritative pricing is always re-validated server-side at checkout.
const FALLBACK_PRICING: Record<TierKey, { monthly: number; yearly: number }> = {
  starter: { monthly: 0, yearly: 0 },
  professional: { monthly: 1900, yearly: 19000 },
  business: { monthly: 4900, yearly: 49000 },
};

const FALLBACK_FEATURES: Record<TierKey, string[]> = {
  starter: ['5 invoices/month', '5 receipts/month', '1 currency account', 'Single user only'],
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
  starter: { name: 'Starter', description: 'For individuals getting started' },
  professional: { name: 'Pro', description: 'For growing businesses' },
  business: { name: 'SME', description: 'For scaling companies' },
  biz: { name: 'Biz', description: 'Enterprise with e-invoicing & compliance' },
};

const planIcons = {
  starter: Zap,
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
  // Show fallback pricing if real data hasn't arrived in 1.5s — keeps perceived load fast
  const [showFallback, setShowFallback] = useState(false);
  
  const { pricingByTier, formatPrice, isLoading: pricingLoading } = useRegionalPricing();
  const { createCheckoutSession, isLoading: checkoutLoading } = useCheckout();
  const { subscription } = useSubscription();
  const { buildFeatureList, isLoading: tierFeaturesLoading } = useTierFeatures();

  // Page view tracking
  useEffect(() => {
    trackFunnel('onboarding_plan_viewed');
  }, []);

  // Trigger fallback rendering if data is slow
  useEffect(() => {
    if (!pricingLoading && !tierFeaturesLoading) return;
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [pricingLoading, tierFeaturesLoading]);

  const dataReady = !pricingLoading && !tierFeaturesLoading;
  const useFallback = !dataReady && showFallback;

  const markPlanSelected = async () => {
    if (user?.id) {
      await supabase.from('profiles').update({ has_selected_plan: true }).eq('id', user.id);
    }
  };

  const queryClient = useQueryClient();

  const handleSelectPlan = async (planTier: TierKey) => {
    trackFunnel('onboarding_plan_selected', {
      plan: planTier,
      billing: isYearly ? 'yearly' : 'monthly',
    });

    if (planTier === 'starter') {
      addTags({ plan_type: 'free' });
      await markPlanSelected();
      supabase.functions.invoke('track-auth-event', {
        body: { event_type: 'plan_selected' },
      }).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ['business-redirect'] });
      navigate('/dashboard');
      return;
    }

    addTags({ plan_type: 'paid' });
    setLoadingTier(planTier);
    await createCheckoutSession(planTier as 'professional' | 'business', isYearly ? 'yearly' : 'monthly');
    setLoadingTier(null);
  };

  const tiers: TierKey[] = ['starter', 'professional', 'business'];

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
            Start free and upgrade as your business grows. All plans include core invoicing features.
          </p>
        </motion.div>

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
        <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, index) => {
            const pricing = pricingByTier[tier];
            const Icon = planIcons[tier];
            const display = TIER_DISPLAY[tier];
            const isRecommended = tier === 'professional';
            const isCurrent = subscription && subscription.tier !== 'starter'
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
                          {isYearly && tier !== 'starter' && yearlyPriceCents && (
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
                          variant={isRecommended ? 'default' : tier === 'starter' ? 'default' : 'outline'}
                          onClick={() => handleSelectPlan(tier)}
                          disabled={checkoutLoading || !!loadingTier}
                        >
                          {isLoadingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : tier === 'starter' ? (
                            <>
                              Continue with Free plan
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
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
      </div>
    </div>
  );
}
