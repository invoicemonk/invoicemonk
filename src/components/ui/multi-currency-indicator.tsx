import * as React from 'react';
import { AlertTriangle, Coins, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatCurrencyAmount } from '@/lib/currency-aggregation';
import { cn } from '@/lib/utils';

export interface CurrencyBreakdownData {
  total: number;
  count: number;
}

export interface MultiCurrencyIndicatorProps {
  /** Whether the aggregate contains multiple currencies */
  hasMultipleCurrencies: boolean;
  /** Whether some amounts couldn't be converted */
  hasUnconvertibleAmounts: boolean;
  /** Number of items excluded from the total */
  excludedCount?: number;
  /** Per-currency breakdown */
  breakdown?: Record<string, CurrencyBreakdownData>;
  /** The primary currency for the aggregate */
  primaryCurrency: string;
  /** Visual style variant */
  variant?: 'inline' | 'card';
  /** Additional class name */
  className?: string;
}

/**
 * Displays an indicator when financial aggregates contain multiple currencies.
 * Shows warnings when amounts are excluded due to missing exchange rates.
 */
export function MultiCurrencyIndicator({
  hasMultipleCurrencies,
  hasUnconvertibleAmounts,
  excludedCount = 0,
  breakdown,
  primaryCurrency,
  variant = 'inline',
  className,
}: MultiCurrencyIndicatorProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Don't render anything if single currency and no issues
  if (!hasMultipleCurrencies && !hasUnconvertibleAmounts) {
    return null;
  }

  const breakdownEntries = breakdown ? Object.entries(breakdown) : [];

  if (variant === 'inline') {
    return (
      <TooltipProvider>
        <div className={cn('inline-flex items-center gap-2', className)}>
          {hasUnconvertibleAmounts ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="border-amber-500 text-amber-600 dark:text-amber-400 cursor-help"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {excludedCount} excluded
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-1">Missing Exchange Rates</p>
                <p className="text-sm text-muted-foreground">
                  {excludedCount} item{excludedCount !== 1 ? 's' : ''} excluded from total 
                  due to missing exchange rates. Set exchange rates when creating 
                  documents to include them in aggregates.
                </p>
              </TooltipContent>
            </Tooltip>
          ) : hasMultipleCurrencies ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="cursor-help">
                  <Coins className="h-3 w-3 mr-1" />
                  Multi-currency
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-1">Multiple Currencies</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Total shown in {primaryCurrency} using stored exchange rates.
                </p>
                {breakdownEntries.length > 0 && (
                  <div className="space-y-1">
                    {breakdownEntries.map(([currency, data]) => (
                      <div key={currency} className="flex justify-between text-sm">
                        <span>{currency}:</span>
                        <span className="font-medium">
                          {formatCurrencyAmount(data.total, currency)} ({data.count})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </TooltipProvider>
    );
  }

  // Card variant - expandable breakdown
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn('rounded-lg border p-3', className, {
        'border-amber-500/50 bg-amber-500/5': hasUnconvertibleAmounts,
        'border-muted': !hasUnconvertibleAmounts,
      })}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              {hasUnconvertibleAmounts ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {excludedCount} item{excludedCount !== 1 ? 's' : ''} excluded from total
                  </span>
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Multiple currencies (converted to {primaryCurrency})
                  </span>
                </>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-3">
          {hasUnconvertibleAmounts && (
            <p className="text-xs text-muted-foreground mb-3">
              These items couldn't be converted because they don't have stored 
              exchange rates. Set exchange rates when creating documents.
            </p>
          )}
          
          {breakdownEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Per-Currency Breakdown
              </p>
              {breakdownEntries.map(([currency, data]) => (
                <div 
                  key={currency} 
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                >
                  <span className="font-medium">{currency}</span>
                  <div className="text-right">
                    <span className="font-medium">
                      {formatCurrencyAmount(data.total, currency)}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      ({data.count} item{data.count !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Simple warning badge for excluded data in charts/trends
 */
export function ExcludedDataWarning({ 
  count, 
  type = 'items',
  className 
}: { 
  count: number; 
  type?: string;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400',
            className
          )}>
            <Info className="h-3 w-3" />
            <span>{count} {type} excluded</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">
            {count} {type} excluded from this view due to missing exchange rates.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
