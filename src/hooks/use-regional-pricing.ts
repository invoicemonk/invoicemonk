import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserBusiness } from '@/hooks/use-business';

export interface RegionalPrice {
  id: string;
  country_code: string;
  currency: string;
  tier: 'starter' | 'professional' | 'business';
  monthly_price: number;
  yearly_price: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  is_default: boolean;
}

interface PricingByTier {
  starter: RegionalPrice | null;
  professional: RegionalPrice | null;
  business: RegionalPrice | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  CAD: 'C$',
  EUR: '€',
};

const CURRENCY_LOCALES: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  GBP: 'en-GB',
  CAD: 'en-CA',
  EUR: 'de-DE',
};

export function useRegionalPricing() {
  const { data: userBusiness } = useUserBusiness();

  // Detect region from business jurisdiction or default to US
  const detectedRegion = userBusiness?.jurisdiction || 'US';

  const { data, isLoading, error } = useQuery({
    queryKey: ['regional-pricing', detectedRegion],
    queryFn: async () => {
      // First try to get pricing for the detected region
      const { data: regionPricing, error: regionError } = await supabase
        .from('pricing_regions')
        .select('*')
        .eq('country_code', detectedRegion);

      if (!regionError && regionPricing && regionPricing.length > 0) {
        return regionPricing as RegionalPrice[];
      }

      // Fall back to default pricing (US)
      const { data: defaultPricing, error: defaultError } = await supabase
        .from('pricing_regions')
        .select('*')
        .eq('is_default', true);

      if (defaultError) {
        console.error('Failed to fetch pricing:', defaultError);
        return [];
      }

      return (defaultPricing || []) as RegionalPrice[];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const pricing = data || [];
  const currency = pricing[0]?.currency || 'USD';
  const countryCode = pricing[0]?.country_code || 'US';

  const pricingByTier: PricingByTier = {
    starter: pricing.find(p => p.tier === 'starter') || null,
    professional: pricing.find(p => p.tier === 'professional') || null,
    business: pricing.find(p => p.tier === 'business') || null,
  };

  const formatPrice = (amount: number, showCurrency = true): string => {
    // Amount is stored in smallest unit (kobo/cents)
    const divisor = currency === 'NGN' ? 100 : 100;
    const formatted = new Intl.NumberFormat(CURRENCY_LOCALES[currency] || 'en-US', {
      style: showCurrency ? 'currency' : 'decimal',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / divisor);

    return formatted;
  };

  const getCurrencySymbol = (): string => {
    return CURRENCY_SYMBOLS[currency] || '$';
  };

  return {
    pricing,
    pricingByTier,
    currency,
    countryCode,
    detectedRegion,
    isLoading,
    error,
    formatPrice,
    getCurrencySymbol,
  };
}
