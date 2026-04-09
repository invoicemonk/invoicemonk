import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger,
  TooltipProvider 
} from '@/components/ui/tooltip';
import { Shield, ShieldCheck, ShieldAlert, BadgeCheck, Clock, XCircle } from 'lucide-react';

type VerificationStatus = 'unverified' | 'self_declared' | 'pending_review' | 'verified' | 'rejected';
type VerificationSource = 'none' | 'stripe_kyc' | 'manual_review' | 'government_api';
type EntityType = 'individual' | 'business' | 'nonprofit';

// Legacy support
type LegacyLevel = 'nrs_linked' | 'regulator_linked';

interface IdentityLevelBadgeProps {
  /** New verification_status field */
  level?: VerificationStatus | LegacyLevel | null;
  /** New verification_source field */
  source?: VerificationSource | null;
  /** Rejection reason (shown in tooltip when rejected) */
  rejectionReason?: string | null;
  /** Entity type for contextual labels */
  entityType?: EntityType | null;
  className?: string;
}

function getConfig(status: string, source?: string | null, rejectionReason?: string | null, entityType?: string | null) {
  const entityLabel = entityType === 'individual' ? 'Individual' 
    : entityType === 'nonprofit' ? 'Organization' 
    : 'Business';

  switch (status) {
    case 'verified':
      return {
        label: source === 'stripe_kyc' ? 'Verified via Stripe' 
             : source === 'government_api' ? 'Regulator Linked'
             : entityType === 'individual' ? 'Verified Individual (ID Verified)'
             : `Verified ${entityLabel}`,
        description: source === 'stripe_kyc' 
          ? `This ${entityLabel.toLowerCase()} has been verified through Stripe KYC. Identity is confirmed.`
          : source === 'government_api'
          ? `This ${entityLabel.toLowerCase()} is linked to a government regulatory system for e-invoicing compliance.`
          : `This ${entityLabel.toLowerCase()} has been manually verified by the Invoicemonk team.`,
        variant: 'default' as const,
        icon: source === 'government_api' ? BadgeCheck : ShieldCheck,
        colorClass: 'text-green-600 dark:text-green-400',
      };
    case 'pending_review':
      return {
        label: 'Pending Review',
        description: 'Verification documents have been submitted and are awaiting admin review.',
        variant: 'secondary' as const,
        icon: Clock,
        colorClass: 'text-amber-600 dark:text-amber-400',
      };
    case 'requires_action':
      return {
        label: 'Action Required',
        description: 'Additional information or documents are needed. Check your business settings for details.',
        variant: 'outline' as const,
        icon: ShieldAlert,
        colorClass: 'text-orange-600 dark:text-orange-400',
      };
    case 'self_declared':
      return {
        label: 'Self-Declared',
        description: 'Tax ID provided but not externally verified. Complete Stripe Connect or upload documents to get verified.',
        variant: 'outline' as const,
        icon: Shield,
        colorClass: 'text-blue-600 dark:text-blue-400',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        description: rejectionReason 
          ? `Verification was rejected: ${rejectionReason}`
          : 'Verification was rejected. Please contact support or resubmit documents.',
        variant: 'destructive' as const,
        icon: XCircle,
        colorClass: 'text-destructive',
      };
    // Legacy values
    case 'nrs_linked':
    case 'regulator_linked':
      return {
        label: 'Regulator Linked',
        description: 'This business is linked to a government regulatory system for e-invoicing compliance.',
        variant: 'default' as const,
        icon: BadgeCheck,
        colorClass: 'text-primary',
      };
    case 'unverified':
    default:
      return {
        label: 'Unverified',
        description: entityType === 'individual' 
          ? 'No verification completed. Upload a government-issued ID or complete Stripe Connect to get verified.'
          : 'No verification completed. Add your tax ID or complete Stripe Connect to get verified.',
        variant: 'secondary' as const,
        icon: ShieldAlert,
        colorClass: 'text-muted-foreground',
      };
  }
}

export function IdentityLevelBadge({ level, source, rejectionReason, entityType, className }: IdentityLevelBadgeProps) {
  const effectiveLevel = level || 'unverified';
  const config = getConfig(effectiveLevel, source, rejectionReason, entityType);
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
