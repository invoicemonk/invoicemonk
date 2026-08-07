import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCountryCurrency } from '@/lib/countries';
import { CurrencySetupGate } from './CurrencySetupGate';

interface CurrencyResolverProps {
  businessId: string;
  businessName: string;
  jurisdiction: string | null;
  onResolved: () => void | Promise<void>;
}

/**
 * A business without `default_currency` cannot issue invoices (the database
 * currency validation trigger rejects them). Before interrupting the user with
 * a setup prompt we try to derive the currency they are already using:
 *   1. the currency of their most recent invoice
 *   2. their default/only currency account
 *   3. the currency of their country
 * Only when none of these exist do we ask.
 */
export function CurrencyResolver({ businessId, businessName, jurisdiction, onResolved }: CurrencyResolverProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['currency-inference', businessId],
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      // 1. Most recent invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('currency')
        .eq('business_id', businessId)
        .not('currency', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Currency account (default first)
      let inferred = (invoice as any)?.currency as string | null | undefined;
      if (!inferred) {
        const { data: account } = await supabase
          .from('currency_accounts')
          .select('currency, is_default')
          .eq('business_id', businessId)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();
        inferred = (account as any)?.currency ?? null;
      }

      // 3. Country
      if (!inferred && jurisdiction) {
        inferred = getCountryCurrency(jurisdiction) ?? null;
      }

      if (!inferred) return { resolved: false as const };

      const { error } = await supabase
        .from('businesses')
        .update({ default_currency: inferred } as any)
        .eq('id', businessId);
      if (error) return { resolved: false as const };

      // Make sure a matching currency account exists so invoices validate.
      const { data: anyAccount } = await supabase
        .from('currency_accounts')
        .select('id')
        .eq('business_id', businessId)
        .limit(1);
      if (!anyAccount || anyAccount.length === 0) {
        await supabase.from('currency_accounts').insert({
          business_id: businessId,
          currency: inferred,
          is_default: true,
          name: `${inferred} Account`,
        } as any);
      }

      await onResolved();
      return { resolved: true as const, currency: inferred };
    },
  });

  if (isLoading || data?.resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading business...</p>
        </div>
      </div>
    );
  }

  return (
    <CurrencySetupGate
      businessId={businessId}
      businessName={businessName}
      jurisdiction={jurisdiction}
      onDone={onResolved}
    />
  );
}