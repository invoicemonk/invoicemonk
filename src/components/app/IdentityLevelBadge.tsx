import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger,
  TooltipProvider 
} from '@/components/ui/tooltip';
import { Shield, ShieldCheck, ShieldAlert, BadgeCheck } from 'lucide-react';

type IdentityLevel = 'unverified' | 'self_declared' | 'verified' | 'nrs_linked' | 'regulator_linked' | null;

interface IdentityLevelBadgeProps {
  level: IdentityLevel;
  className?: string;
}

const levelConfig: Record<NonNullable<IdentityLevel>, {
  label: string;
  description: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  icon: typeof Shield;
  colorClass: string;
}> = {
  unverified: {
    label: 'Unverified',
    description: 'No tax ID provided. Add your tax ID to upgrade to Self-Declared status.',
    variant: 'secondary',
    icon: ShieldAlert,
    colorClass: 'text-muted-foreground',
  },
  self_declared: {
    label: 'Self-Declared',
    description: 'Tax ID provided but not externally verified. Your business details are based on your declaration.',
    variant: 'outline',
    icon: Shield,
    colorClass: 'text-blue-600 dark:text-blue-400',
  },
  verified: {
    label: 'Verified',
    description: 'Your tax ID has been verified with external sources. Your business identity is confirmed.',
    variant: 'default',
    icon: ShieldCheck,
    colorClass: 'text-green-600 dark:text-green-400',
  },
  // Legacy - kept for backward compatibility during transition
  nrs_linked: {
    label: 'Regulator Linked',
    description: 'Your business is linked to a government regulatory system for e-invoicing compliance.',
    variant: 'default',
    icon: BadgeCheck,
    colorClass: 'text-primary',
  },
  // New - global-first naming
  regulator_linked: {
    label: 'Regulator Linked',
    description: 'Your business is linked to a government regulatory system for e-invoicing compliance.',
    variant: 'default',
    icon: BadgeCheck,
    colorClass: 'text-primary',
  },
};

export function IdentityLevelBadge({ level, className }: IdentityLevelBadgeProps) {
  const effectiveLevel = level || 'unverified';
  const config = levelConfig[effectiveLevel];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={config.variant} 
            className={`gap-1.5 cursor-help ${className || ''}`}
          >
            <Icon className={`h-3.5 w-3.5 ${config.colorClass}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
