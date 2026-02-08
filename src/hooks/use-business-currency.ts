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

// All supported currencies with labels
export const ALL_CURRENCIES = [
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
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
