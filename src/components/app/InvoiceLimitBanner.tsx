import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useInvoiceLimitCheck } from '@/hooks/use-subscription';
import { cn } from '@/lib/utils';

interface InvoiceLimitBannerProps {
  className?: string;
}

export function InvoiceLimitBanner({ className }: InvoiceLimitBannerProps) {
  const { data: limitCheck, isLoading } = useInvoiceLimitCheck();

  // Don't show for unlimited tiers or while loading
  if (isLoading || !limitCheck || limitCheck.limit_type === 'unlimited') {
    return null;
  }

  const { current_count = 0, limit_value = 5, remaining = 0 } = limitCheck;
  const usagePercent = Math.min((current_count / limit_value) * 100, 100);
  const isAtLimit = remaining === 0;
  const isNearLimit = remaining <= 2 && remaining > 0;

  if (!isAtLimit && !isNearLimit) {
    return null;
  }

  return (
    <div className={cn(
      'rounded-lg border p-4',
      isAtLimit 
        ? 'bg-destructive/5 border-destructive/30' 
        : 'bg-amber-500/5 border-amber-500/30',
      className
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-2 rounded-full shrink-0',
          isAtLimit ? 'bg-destructive/10' : 'bg-amber-500/10'
        )}>
          {isAtLimit ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className={cn(
              'font-medium',
              isAtLimit ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
            )}>
              {isAtLimit 
                ? 'Invoice limit reached' 
                : `Only ${remaining} invoice${remaining === 1 ? '' : 's'} remaining`}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAtLimit
                ? 'Upgrade to Professional for unlimited invoices this month.'
                : `You've used ${current_count} of ${limit_value} invoices this month.`}
            </p>
          </div>
          
          <div className="space-y-1.5">
            <Progress 
              value={usagePercent} 
              className={cn(
                'h-2',
                isAtLimit && '[&>div]:bg-destructive'
              )}
            />
            <p className="text-xs text-muted-foreground">
              {current_count} / {limit_value} invoices used
            </p>
          </div>
        </div>

        <Button 
          variant={isAtLimit ? 'default' : 'outline'} 
          size="sm" 
          asChild
          className="shrink-0"
        >
          <Link to="/billing">
            Upgrade
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
