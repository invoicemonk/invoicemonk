import { useAuth } from '@/contexts/AuthContext';
import { useUserBusiness } from '@/hooks/use-business';

export interface AccountContext {
  accountId: string;
  accountType: 'individual' | 'business';
  
  // From Business Profile (source of truth)
  displayName: string;
  country: string | null;        // business.jurisdiction
  currency: string;              // business.default_currency
  businessType: string | null;   // business.business_type
  
  // Completeness flags for inline prompts
  hasCountry: boolean;
  hasCurrency: boolean;
  hasBusinessType: boolean;
}

export function useAccountContext(): AccountContext | null {
  const { user, profile } = useAuth();
  const { data: business, isLoading } = useUserBusiness();

  if (!user || isLoading) return null;

  // If user has a business, use business context
  if (business) {
    const businessExtended = business as typeof business & { business_type?: string | null };
    
    return {
      accountId: business.id,
      accountType: 'business',
      displayName: business.name || profile?.full_name || 'Your Business',
      country: business.jurisdiction || null,
      currency: business.default_currency || 'NGN',
      businessType: businessExtended.business_type || null,
      hasCountry: !!business.jurisdiction,
      hasCurrency: !!business.default_currency,
      hasBusinessType: !!businessExtended.business_type,
    };
  }

  // Individual account (no business set up)
  return {
    accountId: user.id,
    accountType: 'individual',
    displayName: profile?.full_name || 'Your Account',
    country: null,
    currency: 'NGN',
    businessType: null,
    hasCountry: false,
    hasCurrency: false,
    hasBusinessType: false,
  };
}
