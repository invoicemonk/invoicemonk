import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
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

// Fetch all currency accounts for a business
export function useCurrencyAccounts(businessId?: string) {
  return useQuery({
    queryKey: ['currency-accounts', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('currency_accounts')
        .select('*')
        .eq('business_id', businessId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CurrencyAccount[];
    },
    enabled: !!businessId,
  });
}

// Create a new currency account
export function useCreateCurrencyAccount() {
  const queryClient = useQueryClient();
  const { currentBusiness } = useBusiness();

  return useMutation({
    mutationFn: async ({ currency, name }: { currency: string; name?: string }) => {
      if (!currentBusiness?.id) {
        throw new Error('No business selected');
      }

      // Check tier limit first
      const { data: limitCheck, error: limitError } = await supabase.rpc('check_currency_account_limit', {
        _business_id: currentBusiness.id,
      });

      if (limitError) {
        throw new Error('Failed to check account limit');
      }

      const limit = limitCheck as { allowed: boolean; tier: string; limit: number | null; current_count: number };
      
      if (!limit.allowed) {
        const tierName = limit.tier === 'starter' || limit.tier === 'starter_paid' 
          ? 'Free/Starter' 
          : limit.tier === 'professional' 
            ? 'Professional' 
            : 'Business';
        
        throw new Error(
          `Currency account limit reached. ${tierName} tier allows ${limit.limit || 1} account(s). ` +
          `Upgrade your plan to add more currency accounts.`
        );
      }

      const { data, error } = await supabase
        .from('currency_accounts')
        .insert({
          business_id: currentBusiness.id,
          currency: currency.toUpperCase(),
          name: name || `${currency.toUpperCase()} Account`,
          is_default: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`A ${currency.toUpperCase()} account already exists for this business`);
        }
        throw error;
      }

      return data as CurrencyAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-accounts'] });
      toast({
        title: 'Currency account created',
        description: 'Your new currency account is ready to use.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating currency account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update a currency account
export function useUpdateCurrencyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('currency_accounts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CurrencyAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-accounts'] });
      toast({
        title: 'Currency account updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating currency account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete a currency account (non-default only)
export function useDeleteCurrencyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First check if it's the default account
      const { data: account, error: fetchError } = await supabase
        .from('currency_accounts')
        .select('is_default')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      
      if (account?.is_default) {
        throw new Error('Cannot delete the default currency account');
      }

      // Check if there are any records using this account
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('currency_account_id', id);

      const { count: expenseCount } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('currency_account_id', id);

      if ((invoiceCount || 0) > 0 || (expenseCount || 0) > 0) {
        throw new Error('Cannot delete a currency account that has invoices or expenses. Archive it instead.');
      }

      const { error } = await supabase
        .from('currency_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-accounts'] });
      toast({
        title: 'Currency account deleted',
        description: 'The currency account has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting currency account',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Get currency account limit info
export function useCurrencyAccountLimit(businessId?: string) {
  return useQuery({
    queryKey: ['currency-account-limit', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase.rpc('check_currency_account_limit', {
        _business_id: businessId,
      });

      if (error) throw error;
      return data as { tier: string; current_count: number; limit: number | null; allowed: boolean };
    },
    enabled: !!businessId,
  });
}
