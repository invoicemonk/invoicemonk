import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './BusinessContext';
import { toast } from '@/hooks/use-toast';

export interface CurrencyAccount {
  id: string;
  business_id: string;
  currency: string;
  name: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface CurrencyAccountLimit {
  tier: string;
  current_count: number;
  limit: number | null;
  allowed: boolean;
}

interface CurrencyAccountContextType {
  currentCurrencyAccount: CurrencyAccount | null;
  currencyAccounts: CurrencyAccount[];
  loading: boolean;
  switchCurrencyAccount: (accountId: string) => void;
  activeCurrency: string;
  checkLimit: () => Promise<CurrencyAccountLimit>;
}

const CurrencyAccountContext = createContext<CurrencyAccountContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'invoicemonk_currency_account_';

export const CurrencyAccountProvider = ({ children }: { children: ReactNode }) => {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Fetch all currency accounts for the current business
  const { data: currencyAccounts = [], isLoading } = useQuery({
    queryKey: ['currency-accounts', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('currency_accounts')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CurrencyAccount[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Load saved selection from localStorage when business changes
  useEffect(() => {
    if (!currentBusiness?.id) {
      setSelectedAccountId(null);
      return;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${currentBusiness.id}`;
    const savedAccountId = localStorage.getItem(storageKey);
    
    if (savedAccountId && currencyAccounts.some(a => a.id === savedAccountId)) {
      setSelectedAccountId(savedAccountId);
    } else {
      // Auto-select default account
      const defaultAccount = currencyAccounts.find(a => a.is_default);
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      } else if (currencyAccounts.length > 0) {
        setSelectedAccountId(currencyAccounts[0].id);
      }
    }
  }, [currentBusiness?.id, currencyAccounts]);

  // Get current currency account
  const currentCurrencyAccount = currencyAccounts.find(a => a.id === selectedAccountId) || 
    currencyAccounts.find(a => a.is_default) || 
    currencyAccounts[0] || 
    null;

  // Switch currency account
  const switchCurrencyAccount = useCallback((accountId: string) => {
    if (!currentBusiness?.id) return;
    
    const account = currencyAccounts.find(a => a.id === accountId);
    if (!account) return;

    setSelectedAccountId(accountId);
    
    // Save to localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}${currentBusiness.id}`;
    localStorage.setItem(storageKey, accountId);

    // Invalidate all financial queries to reload with new currency account scope
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
    queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
    queryClient.invalidateQueries({ queryKey: ['revenue-trend'] });
    queryClient.invalidateQueries({ queryKey: ['due-date-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recent-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['expenses-by-category'] });
  }, [currentBusiness?.id, currencyAccounts, queryClient]);

  // Check tier limit for creating new currency accounts
  const checkLimit = useCallback(async (): Promise<CurrencyAccountLimit> => {
    if (!currentBusiness?.id) {
      return { tier: 'starter', current_count: 0, limit: 1, allowed: false };
    }

    const { data, error } = await supabase.rpc('check_currency_account_limit', {
      _business_id: currentBusiness.id,
    });

    if (error || !data) {
      console.error('Error checking currency account limit:', error);
      return { tier: 'starter', current_count: 0, limit: 1, allowed: false };
    }

      return data as unknown as CurrencyAccountLimit;
  }, [currentBusiness?.id]);

  // Derived active currency
  const activeCurrency = currentCurrencyAccount?.currency || currentBusiness?.default_currency || 'NGN';

  return (
    <CurrencyAccountContext.Provider
      value={{
        currentCurrencyAccount,
        currencyAccounts,
        loading: isLoading,
        switchCurrencyAccount,
        activeCurrency,
        checkLimit,
      }}
    >
      {children}
    </CurrencyAccountContext.Provider>
  );
};

export const useCurrencyAccount = () => {
  const context = useContext(CurrencyAccountContext);
  if (context === undefined) {
    throw new Error('useCurrencyAccount must be used within a CurrencyAccountProvider');
  }
  return context;
};

// Safe version that returns null when used outside provider
export const useCurrencyAccountOptional = () => {
  return useContext(CurrencyAccountContext);
};
