import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { AccessDenied } from './AccessDenied';

interface BusinessAccessGuardProps {
  /**
   * The business_id of the resource being accessed.
   * - If null/undefined: Treated as a user-level resource, access allowed
   * - If provided: User must be a member of this business to access
   */
  businessId: string | null | undefined;
  
  /**
   * The content to render if access is granted.
   */
  children: ReactNode;
  
  /**
   * Type of resource for error messaging (e.g., "invoice", "receipt", "client")
   */
  resourceType?: string;
}

/**
 * BusinessAccessGuard - UI-layer defense-in-depth for business resource access.
 * 
 * This component validates that the current user has membership in the business
 * that owns a resource before rendering the content.
 * 
 * SECURITY NOTES:
 * 1. RLS policies at the database level are the PRIMARY access control mechanism.
 *    This component provides SECONDARY UI-layer protection.
 * 
 * 2. This guard ensures:
 *    - Clear "Access Denied" UX (not ambiguous "not found")
 *    - Defense against potential future RLS misconfigurations
 *    - Intentional and visible access denials
 *    - Consistent security patterns across the codebase
 * 
 * 3. Access logic:
 *    - businessId is null/undefined → user-level resource, ALLOW
 *    - User is member of the business → ALLOW
 *    - Otherwise → DENY with clear messaging
 * 
 * Usage:
 * ```tsx
 * <BusinessAccessGuard businessId={invoice.business_id} resourceType="invoice">
 *   <InvoiceContent invoice={invoice} />
 * </BusinessAccessGuard>
 * ```
 */
export function BusinessAccessGuard({ 
  businessId, 
  children, 
  resourceType = 'resource' 
}: BusinessAccessGuardProps) {
  const { businesses, loading } = useBusiness();

  // Still loading business memberships - show loading state
  // This prevents any data flash before access check completes
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No business_id means this is a user-level resource (e.g., personal client)
  // User-level resources are accessible to the owning user (RLS handles this)
  if (!businessId) {
    return <>{children}</>;
  }

  // Check if user is a member of the business that owns this resource
  const hasAccess = businesses.some(membership => membership.business_id === businessId);

  if (!hasAccess) {
    return (
      <AccessDenied 
        resourceType={resourceType}
        message={`You don't have permission to view this ${resourceType}. You are not a member of the business that owns it.`}
        showBackButton={true}
        showSupportLink={true}
      />
    );
  }

  // Access granted - render children
  return <>{children}</>;
}

/**
 * Hook version for cases where you need programmatic access checking
 * without the component wrapper.
 */
export function useBusinessAccess(businessId: string | null | undefined): {
  loading: boolean;
  hasAccess: boolean;
} {
  const { businesses, loading } = useBusiness();

  if (loading) {
    return { loading: true, hasAccess: false };
  }

  // No business_id = user-level resource = access allowed
  if (!businessId) {
    return { loading: false, hasAccess: true };
  }

  const hasAccess = businesses.some(membership => membership.business_id === businessId);
  
  return { loading: false, hasAccess };
}
