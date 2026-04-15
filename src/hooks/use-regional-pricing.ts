import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RegionalPrice {
  id: string;
  country_code: string;
  currency: string;
  tier: 'starter' | 'starter_paid' | 'professional' | 'business';
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

// Currencies that don't use decimal places
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'IDR', 'CLP', 'PYG', 'UGX', 'RWF', 'KMF', 'XOF', 'XAF', 'GNF',
  'BIF', 'DJF', 'MGA', 'VUV', 'XPF',
]);

// Currencies that use 3 decimal places
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'KWD', 'OMR', 'JOD']);

export function useRegionalPricing() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['regional-pricing', 'USD'],
    queryFn: async () => {
      // Always fetch default USD pricing — no more per-country detection
      const { data: pricing, error } = await supabase
        .from('pricing_regions')
        .select('*')
        .eq('is_default', true);

      if (error) {
        console.error('Failed to fetch pricing:', error);
        return [];
      }

      return (pricing || []) as RegionalPrice[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const pricing = data || [];
  const currency = 'USD';
  const countryCode = 'US';

  const pricingByTier: PricingByTier = {
    starter: pricing.find(p => p.tier === 'starter') || null,
    professional: pricing.find(p => p.tier === 'professional') || null,
    business: pricing.find(p => p.tier === 'business') || null,
  };

  const formatPrice = (amount: number, showCurrency = true): string => {
    let divisor = 100;
    if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1;
    } else if (THREE_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1000;
    }

    try {
      return new Intl.NumberFormat('en-US', {
        style: showCurrency ? 'currency' : 'decimal',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount / divisor);
    } catch {
      const value = amount / divisor;
      return showCurrency ? `$${value.toLocaleString()}` : value.toLocaleString();
    }
  };

  const getCurrencySymbol = (): string => '$';

  const formatAmount = (amount: number, currencyCode: string, showCurrency = true): string => {
    let divisor = 100;
    if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) {
      divisor = 1;
    } else if (THREE_DECIMAL_CURRENCIES.has(currencyCode)) {
      divisor = 1000;
    }

    try {
      return new Intl.NumberFormat('en-US', {
        style: showCurrency ? 'currency' : 'decimal',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount / divisor);
    } catch {
      const value = amount / divisor;
      return showCurrency ? `${currencyCode} ${value.toLocaleString()}` : value.toLocaleString();
    }
  };

  return {
    pricing,
    pricingByTier,
    currency,
    countryCode,
    detectedRegion: 'US',
    isLoading,
    error,
    formatPrice,
    formatAmount,
    getCurrencySymbol,
  };
}

/**
 * Standalone currency formatting utilities (can be used outside React components)
 */
export const currencyUtils = {
  getSymbol: (currency: string): string => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', NGN: '₦', CAD: 'C$' };
    return symbols[currency] || currency;
  },
  getLocale: (currency: string): string => {
    const locales: Record<string, string> = { USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', NGN: 'en-NG', CAD: 'en-CA' };
    return locales[currency] || 'en-US';
  },
  isZeroDecimal: (currency: string): boolean => ZERO_DECIMAL_CURRENCIES.has(currency),
  
  format: (amount: number, currency: string, showSymbol = true): string => {
    let divisor = 100;
    if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1;
    } else if (THREE_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1000;
    }

    const locale = currencyUtils.getLocale(currency);
    
    try {
      return new Intl.NumberFormat(locale, {
        style: showSymbol ? 'currency' : 'decimal',
        currency: currency,
        minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 0,
        maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      }).format(amount / divisor);
    } catch {
      const value = amount / divisor;
      const symbol = currencyUtils.getSymbol(currency);
      return showSymbol ? `${symbol}${value.toLocaleString()}` : value.toLocaleString();
    }
  },
};
