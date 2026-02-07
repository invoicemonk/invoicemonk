import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserBusiness } from '@/hooks/use-business';

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
  starter_paid: RegionalPrice | null;
  professional: RegionalPrice | null;
  business: RegionalPrice | null;
}

// Comprehensive currency symbols for global support
const CURRENCY_SYMBOLS: Record<string, string> = {
  // Major currencies
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  
  // Americas
  CAD: 'C$',
  MXN: 'MX$',
  BRL: 'R$',
  ARS: '$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  UYU: '$U',
  
  // Europe
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  RUB: '₽',
  UAH: '₴',
  
  // Africa
  NGN: '₦',
  ZAR: 'R',
  GHS: 'GH₵',
  KES: 'KSh',
  EGP: 'E£',
  MAD: 'DH',
  TZS: 'TSh',
  UGX: 'USh',
  RWF: 'FRw',
  XOF: 'CFA',
  XAF: 'FCFA',
  
  // Asia-Pacific
  INR: '₹',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  KRW: '₩',
  THB: '฿',
  MYR: 'RM',
  IDR: 'Rp',
  PHP: '₱',
  VND: '₫',
  PKR: '₨',
  BDT: '৳',
  LKR: 'Rs',
  
  // Middle East
  AED: 'د.إ',
  SAR: '﷼',
  QAR: 'QR',
  KWD: 'KD',
  BHD: 'BD',
  OMR: 'OMR',
  JOD: 'JD',
  ILS: '₪',
  TRY: '₺',
  
  // Oceania
  AUD: 'A$',
  NZD: 'NZ$',
  FJD: 'FJ$',
};

// Locale mappings for proper number formatting
const CURRENCY_LOCALES: Record<string, string> = {
  // Major currencies
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  
  // Americas
  CAD: 'en-CA',
  MXN: 'es-MX',
  BRL: 'pt-BR',
  ARS: 'es-AR',
  CLP: 'es-CL',
  COP: 'es-CO',
  PEN: 'es-PE',
  
  // Europe
  CHF: 'de-CH',
  SEK: 'sv-SE',
  NOK: 'nb-NO',
  DKK: 'da-DK',
  PLN: 'pl-PL',
  CZK: 'cs-CZ',
  HUF: 'hu-HU',
  RON: 'ro-RO',
  RUB: 'ru-RU',
  UAH: 'uk-UA',
  
  // Africa
  NGN: 'en-NG',
  ZAR: 'en-ZA',
  GHS: 'en-GH',
  KES: 'en-KE',
  EGP: 'ar-EG',
  MAD: 'ar-MA',
  TZS: 'en-TZ',
  UGX: 'en-UG',
  RWF: 'en-RW',
  XOF: 'fr-SN',
  XAF: 'fr-CM',
  
  // Asia-Pacific
  INR: 'en-IN',
  SGD: 'en-SG',
  HKD: 'zh-HK',
  TWD: 'zh-TW',
  KRW: 'ko-KR',
  THB: 'th-TH',
  MYR: 'ms-MY',
  IDR: 'id-ID',
  PHP: 'en-PH',
  VND: 'vi-VN',
  PKR: 'ur-PK',
  BDT: 'bn-BD',
  
  // Middle East
  AED: 'ar-AE',
  SAR: 'ar-SA',
  QAR: 'ar-QA',
  KWD: 'ar-KW',
  ILS: 'he-IL',
  TRY: 'tr-TR',
  
  // Oceania
  AUD: 'en-AU',
  NZD: 'en-NZ',
};

// Currencies that don't use decimal places
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'IDR', 'CLP', 'PYG', 'UGX', 'RWF', 'KMF', 'XOF', 'XAF', 'GNF',
  'BIF', 'DJF', 'MGA', 'VUV', 'XPF',
]);

// Currencies that use 3 decimal places
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'KWD', 'OMR', 'JOD']);

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
    starter_paid: pricing.find(p => p.tier === 'starter_paid') || null,
    professional: pricing.find(p => p.tier === 'professional') || null,
    business: pricing.find(p => p.tier === 'business') || null,
  };

  // Nigeria-specific: Check if starter_paid tier is available (Nigeria only)
  const hasStarterPaidTier = !!pricingByTier.starter_paid;
  const isNigeria = countryCode === 'NG';

  /**
   * Format a price amount for display
   * @param amount - Amount in smallest currency unit (cents, kobo, etc.)
   * @param showCurrency - Whether to include currency symbol
   */
  const formatPrice = (amount: number, showCurrency = true): string => {
    // Determine divisor based on currency decimal places
    let divisor = 100;
    if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1;
    } else if (THREE_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1000;
    }

    const locale = CURRENCY_LOCALES[currency] || 'en-US';
    
    try {
      const formatted = new Intl.NumberFormat(locale, {
        style: showCurrency ? 'currency' : 'decimal',
        currency: currency,
        minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 0,
        maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      }).format(amount / divisor);

      return formatted;
    } catch {
      // Fallback for unsupported currencies
      const value = amount / divisor;
      const symbol = CURRENCY_SYMBOLS[currency] || currency;
      return showCurrency ? `${symbol}${value.toLocaleString()}` : value.toLocaleString();
    }
  };

  /**
   * Get the currency symbol for the current currency
   */
  const getCurrencySymbol = (): string => {
    return CURRENCY_SYMBOLS[currency] || currency;
  };

  /**
   * Format any amount in a specific currency (not just current pricing currency)
   */
  const formatAmount = (amount: number, currencyCode: string, showCurrency = true): string => {
    let divisor = 100;
    if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) {
      divisor = 1;
    } else if (THREE_DECIMAL_CURRENCIES.has(currencyCode)) {
      divisor = 1000;
    }

    const locale = CURRENCY_LOCALES[currencyCode] || 'en-US';
    
    try {
      return new Intl.NumberFormat(locale, {
        style: showCurrency ? 'currency' : 'decimal',
        currency: currencyCode,
        minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 0,
        maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2,
      }).format(amount / divisor);
    } catch {
      const value = amount / divisor;
      const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
      return showCurrency ? `${symbol}${value.toLocaleString()}` : value.toLocaleString();
    }
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
    formatAmount,
    getCurrencySymbol,
    hasStarterPaidTier,
    isNigeria,
  };
}

/**
 * Standalone currency formatting utilities (can be used outside React components)
 */
export const currencyUtils = {
  getSymbol: (currency: string): string => CURRENCY_SYMBOLS[currency] || currency,
  getLocale: (currency: string): string => CURRENCY_LOCALES[currency] || 'en-US',
  isZeroDecimal: (currency: string): boolean => ZERO_DECIMAL_CURRENCIES.has(currency),
  
  format: (amount: number, currency: string, showSymbol = true): string => {
    let divisor = 100;
    if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1;
    } else if (THREE_DECIMAL_CURRENCIES.has(currency)) {
      divisor = 1000;
    }

    const locale = CURRENCY_LOCALES[currency] || 'en-US';
    
    try {
      return new Intl.NumberFormat(locale, {
        style: showSymbol ? 'currency' : 'decimal',
        currency: currency,
        minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 0,
        maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      }).format(amount / divisor);
    } catch {
      const value = amount / divisor;
      const symbol = CURRENCY_SYMBOLS[currency] || currency;
      return showSymbol ? `${symbol}${value.toLocaleString()}` : value.toLocaleString();
    }
  },
};
