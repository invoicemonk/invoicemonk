import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountContext } from '@/hooks/use-account-context';
import { toast } from '@/hooks/use-toast';

export type AccountingPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface AccountingPreferences {
  id: string;
  accountId: string;
  accountType: 'individual' | 'business';
  defaultAccountingPeriod: AccountingPeriod;
}

export function useAccountingPreferences() {
  const { user } = useAuth();
  const accountContext = useAccountContext();

  return useQuery({
    queryKey: ['accounting-preferences', accountContext?.accountId],
    queryFn: async (): Promise<AccountingPreferences> => {
      if (!user || !accountContext) {
        throw new Error('Not authenticated');
      }

      // Try to fetch existing preferences
      const { data, error } = await supabase
        .from('accounting_preferences')
        .select('*')
        .eq('account_id', accountContext.accountId)
        .eq('account_type', accountContext.accountType)
        .maybeSingle();

      if (error) throw error;

      // Return existing preferences or default values
      if (data) {
        return {
          id: data.id,
          accountId: data.account_id,
          accountType: data.account_type as 'individual' | 'business',
          defaultAccountingPeriod: data.default_accounting_period as AccountingPeriod,
        };
      }

      // Return default values (preferences will be created on first update)
      return {
        id: '',
        accountId: accountContext.accountId,
        accountType: accountContext.accountType,
        defaultAccountingPeriod: 'monthly',
      };
    },
    enabled: !!user && !!accountContext,
  });
}

export function useUpdateAccountingPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const accountContext = useAccountContext();

  return useMutation({
    mutationFn: async (updates: { defaultAccountingPeriod: AccountingPeriod }) => {
      if (!user || !accountContext) throw new Error('Not authenticated');

      // Upsert preferences
      const { data, error } = await supabase
        .from('accounting_preferences')
        .upsert({
          account_id: accountContext.accountId,
          account_type: accountContext.accountType,
          user_id: user.id,
          default_accounting_period: updates.defaultAccountingPeriod,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'account_id,account_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-preferences'] });
      toast({
        title: 'Preferences saved',
        description: 'Your accounting preferences have been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
