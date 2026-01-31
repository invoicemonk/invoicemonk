import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  Zap, 
  Shield, 
  Building2, 
  Loader2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRegionalPricing } from '@/hooks/use-regional-pricing';
import { useCheckout } from '@/hooks/use-checkout';
import { useSubscription } from '@/hooks/use-subscription';
import logoImage from '@/assets/invoicemonk-logo.png';

const planFeatures = {
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
  professional: Shield,
  business: Building2,
};

export default function PlanSelection() {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  
  const { pricingByTier, formatPrice, currency, countryCode, isLoading: pricingLoading } = useRegionalPricing();
  const { createCheckoutSession, isLoading: checkoutLoading } = useCheckout();
  const { tier: currentTier } = useSubscription();

  const handleSelectPlan = async (tier: 'starter' | 'professional' | 'business') => {
    if (tier === 'starter') {
      // Free plan - just go to dashboard
      navigate('/dashboard');
      return;
    }

    setLoadingTier(tier);
    await createCheckoutSession(tier, isYearly ? 'yearly' : 'monthly', countryCode);
    setLoadingTier(null);
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  const tiers: Array<'starter' | 'professional' | 'business'> = ['starter', 'professional', 'business'];

  if (pricingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-6xl mx-auto">
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
          transition={{ delay: 0.1 }}
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
            <Badge variant="secondary" className="ml-2">Save 20%</Badge>
          </Label>
        </motion.div>

        {/* Plan Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {tiers.map((tier, index) => {
            const pricing = pricingByTier[tier];
            const Icon = planIcons[tier];
            const isRecommended = tier === 'professional';
            const isCurrent = tier === currentTier;
            const isLoadingThis = loadingTier === tier;
            
            const price = pricing 
              ? (isYearly && pricing.yearly_price 
                  ? pricing.yearly_price / 12 // Show monthly equivalent
                  : pricing.monthly_price)
              : 0;

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
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </CardTitle>
                    <CardDescription>
                      {tier === 'starter' && 'For individuals getting started'}
                      {tier === 'professional' && 'For growing businesses'}
                      {tier === 'business' && 'For enterprises with advanced needs'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="mb-4">
                      <span className="text-4xl font-bold">{formatPrice(price)}</span>
                      <span className="text-muted-foreground">/month</span>
                      {isYearly && tier !== 'starter' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Billed {formatPrice(pricing?.yearly_price || 0)} yearly
                        </p>
                      )}
                    </div>
                    
                    <Separator className="mb-4" />
                    
                    <ul className="space-y-3 flex-1">
                      {planFeatures[tier].map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
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
                          ) : tier === 'starter' ? (
                            'Start Free'
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
        </div>

        {/* Skip Link */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip for now — continue with Free plan
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
