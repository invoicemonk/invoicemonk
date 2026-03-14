import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessCurrency {
  id: string;
  name: string;
  default_currency: string | null;
  currency_locked: boolean;
  currency_locked_at: string | null;
  allowed_currencies: string[] | null;
}

// All supported currencies with labels (covers all 42 jurisdictions)
export const ALL_CURRENCIES = [
  // Africa
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
  { value: 'GHS', label: 'GHS - Ghanaian Cedi' },
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'EGP', label: 'EGP - Egyptian Pound' },
  { value: 'TZS', label: 'TZS - Tanzanian Shilling' },
  { value: 'UGX', label: 'UGX - Ugandan Shilling' },
  { value: 'RWF', label: 'RWF - Rwandan Franc' },
  { value: 'XOF', label: 'XOF - CFA Franc (West Africa)' },
  // Americas
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'ARS', label: 'ARS - Argentine Peso' },
  { value: 'CLP', label: 'CLP - Chilean Peso' },
  { value: 'COP', label: 'COP - Colombian Peso' },
  // Europe
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'PLN', label: 'PLN - Polish Zloty' },
  { value: 'HUF', label: 'HUF - Hungarian Forint' },
  { value: 'RON', label: 'RON - Romanian Leu' },
  { value: 'BGN', label: 'BGN - Bulgarian Lev' },
  { value: 'RSD', label: 'RSD - Serbian Dinar' },
  // Asia-Pacific
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
  { value: 'PHP', label: 'PHP - Philippine Peso' },
  // Middle East
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  // Oceania
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
] as const;

/** Returns the permitted currencies for a business: {default_currency} ∪ allowed_currencies */
export function getPermittedCurrencies(businessCurrency: BusinessCurrency | null | undefined) {
  if (!businessCurrency?.default_currency) return ALL_CURRENCIES;
  const permitted = new Set<string>([businessCurrency.default_currency]);
  businessCurrency.allowed_currencies?.forEach(c => permitted.add(c));
  return ALL_CURRENCIES.filter(c => permitted.has(c.value));
}

export function useBusinessCurrency(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ['business-currency', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, default_currency, currency_locked, currency_locked_at, allowed_currencies')
        .eq('id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Business currency fetch error:', error);
        return null;
      }

      return data as BusinessCurrency | null;
    },
    enabled: !!businessId,
    staleTime: 2 * 60 * 1000,
  });
}
