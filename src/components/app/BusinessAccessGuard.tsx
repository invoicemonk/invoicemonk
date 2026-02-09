import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { AccessDenied } from './AccessDenied';

interface BusinessAccessGuardProps {
  businessId: string | null | undefined;
  children: ReactNode;
  resourceType?: string;
}

/**
 * Defense-in-depth guard that verifies the current user has membership
 * in the business that owns the resource before rendering children.
 *
 * - If businessId is null/undefined: allows access (user-level resource)
 * - If user is a platform admin: allows access (bypass)
 * - If user is a member of the business: allows access
 * - Otherwise: shows AccessDenied UI
 *
 * RLS remains the primary access control layer at the database level.
 * This component prevents ambiguous "not found" UX when access is denied.
 */
export function BusinessAccessGuard({ 
  businessId, 
  children, 
  resourceType = 'resource' 
}: BusinessAccessGuardProps) {
  const { businesses, loading, isPlatformAdmin } = useBusiness();

  // Still loading business memberships
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Platform admins bypass all access checks
  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  // No business_id = user-level resource, allow access
  if (!businessId) {
    return <>{children}</>;
  }

  // Check if user is a member of the business that owns this resource
  const hasAccess = businesses.some(m => m.business_id === businessId);

  if (!hasAccess) {
    return <AccessDenied resourceType={resourceType} />;
  }

  return <>{children}</>;
}
