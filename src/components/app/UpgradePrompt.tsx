import { Link } from 'react-router-dom';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  feature: string;
  title?: string;
  description?: string;
  requiredTier?: 'professional' | 'business';
  variant?: 'card' | 'inline' | 'banner';
  className?: string;
}

const TIER_BENEFITS: Record<string, string[]> = {
  professional: [
    'Unlimited invoices',
    'Full audit trail access',
    'Data exports (CSV, PDF)',
    'Invoice verification portal',
    'Custom branding',
    'Premium templates',
    'Advanced reports',
  ],
  business: [
    'Everything in Professional',
    'Up to 10 team members',
    'Organization dashboard',
    'API access',
    'Bulk invoice operations',
    'Priority support',
  ],
};

export function UpgradePrompt({
  feature,
  title,
  description,
  requiredTier = 'professional',
  variant = 'card',
  className,
}: UpgradePromptProps) {
  const defaultTitle = `Upgrade to ${requiredTier === 'business' ? 'Business' : 'Professional'}`;
  const defaultDescription = `${feature} requires a ${requiredTier === 'business' ? 'Business' : 'Professional'} subscription. Upgrade now to unlock this feature and many more.`;

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-muted', className)}>
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {feature} requires {requiredTier === 'business' ? 'Business' : 'Professional'} tier
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/billing">
            Upgrade
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-lg',
        'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent',
        'border border-primary/20',
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{title || defaultTitle}</p>
            <p className="text-sm text-muted-foreground">
              Unlock {feature.toLowerCase()} and more powerful features
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/billing">
            Upgrade Now
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    );
  }

  // Default card variant
  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <Badge variant="secondary" className="w-fit mx-auto mb-2">
          {requiredTier === 'business' ? 'Business' : 'Professional'} Feature
        </Badge>
        <CardTitle>{title || defaultTitle}</CardTitle>
        <CardDescription className="max-w-md mx-auto">
          {description || defaultDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          {TIER_BENEFITS[requiredTier].slice(0, 5).map((benefit, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" asChild>
            <Link to="/billing">
              Upgrade to {requiredTier === 'business' ? 'Business' : 'Professional'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/pricing">View Plans</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Small tier badge for locked items
export function TierBadge({ tier }: { tier: 'professional' | 'business' }) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-xs',
        tier === 'business' 
          ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' 
          : 'border-primary/50 text-primary'
      )}
    >
      <Lock className="h-2.5 w-2.5 mr-1" />
      {tier === 'business' ? 'Business' : 'Pro'}
    </Badge>
  );
}
