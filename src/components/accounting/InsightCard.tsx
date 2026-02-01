import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  title: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function InsightCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  trendValue,
  className 
}: Props) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' 
    ? 'text-emerald-600 dark:text-emerald-400' 
    : trend === 'down' 
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-semibold truncate">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
            )}
            {trend && trendValue && (
              <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendValue}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
