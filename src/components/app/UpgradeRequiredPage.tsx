import { Link } from 'react-router-dom';
import { Lock, ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UpgradeRequiredPageProps {
  feature: string;
  description: string;
  upgradeUrl: string;
  requiredTier?: string;
  benefits?: string[];
  className?: string;
}

export function UpgradeRequiredPage({
  feature,
  description,
  upgradeUrl,
  requiredTier = 'Professional',
  benefits,
  className,
}: UpgradeRequiredPageProps) {
  const defaultBenefits = [
    'Unlock full functionality',
    'No usage restrictions',
    'Priority support',
    'Advanced features',
  ];

  const displayBenefits = benefits || defaultBenefits;

  return (
    <div className={cn('flex items-center justify-center min-h-[60vh] p-6', className)}>
      <Card className="max-w-lg w-full border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <Badge variant="secondary" className="w-fit mx-auto mb-3">
            {requiredTier} Feature
          </Badge>
          <CardTitle className="text-2xl">{feature}</CardTitle>
          <CardDescription className="text-base mt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            {displayBenefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full" asChild>
              <Link to={upgradeUrl}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Upgrade to {requiredTier}
              </Link>
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Upgrade anytime. Cancel anytime.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
