import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Globe, Shield, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { COUNTRY_OPTIONS, getCountryByCode, getCountryCurrency } from '@/lib/countries';
import { getJurisdictionConfig } from '@/lib/jurisdiction-config';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

function getSmartPrefillAmount(currency: string): number {
  const zeroDecimal = ['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'RWF'];
  const lowValue = ['NGN', 'KES', 'TZS', 'GHS', 'EGP', 'PKR', 'INR', 'PHP', 'BDT', 'LKR', 'MXN', 'COP', 'ARS', 'CZK', 'HUF', 'PLN', 'THB', 'ZAR', 'MAD', 'XOF', 'XAF', 'IDR'];
  if (zeroDecimal.includes(currency)) return 10000;
  if (lowValue.includes(currency)) return 10000;
  return 100;
}

export default function CountryConfirmation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    // Auto-detect country from browser locale (e.g. 'en-NG' → 'NG')
    try {
      const locale = navigator.language || '';
      const parts = locale.split('-');
      if (parts.length >= 2) {
        const code = parts[parts.length - 1].toUpperCase();
        if (COUNTRY_OPTIONS.some(c => c.code === code)) {
          return code;
        }
      }
    } catch {}
    return '';
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user's first business directly (no BusinessProvider needed)
  const { data: businessData, isLoading } = useQuery({
    queryKey: ['onboarding-business', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const businessId = businessData?.business_id;
  const country = selectedCountry ? getCountryByCode(selectedCountry) : null;
  const currency = country ? getCountryCurrency(selectedCountry) : null;
  const jurisdictionConfig = selectedCountry ? getJurisdictionConfig(selectedCountry) : null;
  const sampleAmount = currency ? getSmartPrefillAmount(currency) : 100;

  const handleContinue = async () => {
    if (!selectedCountry || !businessId || !currency) return;

    setIsSaving(true);
    try {
      const updatePayload: Record<string, any> = {
        jurisdiction: selectedCountry,
        default_currency: currency,
      };
      // Set jurisdiction-aware invoice number digits default
      if (jurisdictionConfig?.invoiceNumberDigits) {
        updatePayload.invoice_number_digits = jurisdictionConfig.invoiceNumberDigits;
      }
      const { error } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', businessId);

      if (error) throw error;

      // Invalidate relevant queries (default currency account is synced automatically by DB trigger)
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business-redirect'] });

      const countryName = country?.name || selectedCountry;
      toast({
        title: 'Business location set',
        description: `Your business is set up for compliant invoicing in ${countryName}.`,
      });

      navigate(`/b/${businessId}/dashboard`, { replace: true });
    } catch (err: any) {
      toast({
        title: 'Error saving location',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
            <Globe className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Where does your business operate?</h1>
          <p className="text-muted-foreground">
            This helps us format your invoices with the correct currency and tax labels.
          </p>
        </div>

        {/* Country Selector */}
        <div className="space-y-3">
          <Label htmlFor="country">Country</Label>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger id="country" className="h-12">
              <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select your country..." />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic Compliance Preview */}
        {selectedCountry && currency && jurisdictionConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            {/* Currency & Tax Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-sm py-1 px-3">
                Currency: {currency}
              </Badge>
              {jurisdictionConfig.showVat && jurisdictionConfig.vatLabel && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  Tax: {jurisdictionConfig.vatLabel}
                </Badge>
              )}
              <Badge variant="outline" className="text-sm py-1 px-3">
                {jurisdictionConfig.taxIdLabel}
              </Badge>
            </div>

            {/* Mini Invoice Preview */}
            <Card className="border-dashed">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Invoice Preview
                </div>
                <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sample Service</span>
                    <span className="font-medium">{formatCurrency(sampleAmount, currency)}</span>
                  </div>
                  {jurisdictionConfig.showVat && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{jurisdictionConfig.vatLabel || 'VAT'}</span>
                      <span>{formatCurrency(sampleAmount * 0.075, currency)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>
                      {formatCurrency(
                        jurisdictionConfig.showVat ? sampleAmount * 1.075 : sampleAmount,
                        currency
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confidence message */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Your invoices will be automatically formatted for{' '}
                <span className="font-medium text-foreground">{country?.name}</span> compliance requirements.
              </p>
            </div>
          </motion.div>
        )}

        {/* Continue Button */}
        <Button
          className="w-full h-12"
          size="lg"
          onClick={handleContinue}
          disabled={!selectedCountry || isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 mr-2" />
          )}
          {isSaving ? 'Setting up...' : 'Continue to Dashboard'}
        </Button>
      </motion.div>
    </div>
  );
}
