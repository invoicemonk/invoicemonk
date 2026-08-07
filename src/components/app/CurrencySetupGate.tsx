import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { COUNTRY_OPTIONS, getCountryCurrency } from '@/lib/countries';
import { ALL_CURRENCIES } from '@/hooks/use-business-currency';
import { toast } from '@/hooks/use-toast';

interface CurrencySetupGateProps {
  businessId: string;
  businessName: string;
  jurisdiction: string | null;
  onDone: () => void | Promise<void>;
}

/**
 * Blocking prompt for legacy businesses that never got a country / invoicing
 * currency. Without those, every invoice insert fails the currency validation
 * trigger, so we ask for them before letting the workspace render.
 */
export function CurrencySetupGate({ businessId, businessName, jurisdiction, onDone }: CurrencySetupGateProps) {
  const queryClient = useQueryClient();
  const [country, setCountry] = useState(jurisdiction ?? '');
  const [currency, setCurrency] = useState(
    jurisdiction ? getCountryCurrency(jurisdiction) ?? '' : ''
  );
  const [saving, setSaving] = useState(false);

  const currencyOptions = useMemo(() => ALL_CURRENCIES, []);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const suggested = getCountryCurrency(code);
    if (suggested) setCurrency(suggested);
  };

  const handleSave = async () => {
    if (!country || !currency) {
      toast({ title: 'Select a country and currency', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ jurisdiction: country, default_currency: currency } as any)
        .eq('id', businessId);
      if (error) throw error;

      const { data: accounts } = await supabase
        .from('currency_accounts')
        .select('id')
        .eq('business_id', businessId)
        .limit(1);

      if (!accounts || accounts.length === 0) {
        await supabase.from('currency_accounts').insert({
          business_id: businessId,
          currency,
          is_default: true,
          name: `${currency} Account`,
        } as any);
      }

      await queryClient.invalidateQueries();
      await onDone();
      toast({ title: 'Setup complete', description: `${businessName} now invoices in ${currency}.` });
    } catch (e: any) {
      toast({
        title: 'Could not save',
        description: e?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Finish setting up {businessName}
          </CardTitle>
          <CardDescription>
            We need your country and invoicing currency before you can create invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={handleCountryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COUNTRY_OPTIONS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Invoicing currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {currencyOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This becomes your default currency account. You can add more currencies later.
            </p>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save and continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}