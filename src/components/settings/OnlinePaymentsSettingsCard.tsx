import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Coins, CreditCard, Building2, ArrowRight, CheckCircle2, 
  Clock, AlertCircle, Loader2, ExternalLink, Banknote, Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStripeConnect, usePaystackSubaccount } from '@/hooks/use-online-payments';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';
import { Link } from 'react-router-dom';

// Nigerian banks list (common ones)
const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '063', name: 'Diamond Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999992', name: 'Opay' },
  { code: '999991', name: 'PalmPay' },
  { code: '50211', name: 'Kuda Bank' },
];

interface OnlinePaymentsSettingsCardProps {
  business: any;
}

export function OnlinePaymentsSettingsCard({ business }: OnlinePaymentsSettingsCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { initiateConnect, loading: connectLoading } = useStripeConnect();
  const { createSubaccount, loading: paystackLoading } = usePaystackSubaccount();
  const { tier } = useBusiness();
  const isFreeStarterTier = tier === 'starter';

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const isNigerian = business.jurisdiction === 'NG';
  const stripeStatus = business.stripe_connect_status || 'not_started';
  const paystackStatus = business.paystack_subaccount_status || 'not_started';

  const handleTogglePayments = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ online_payments_enabled: checked } as any)
        .eq('id', business.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      toast({
        title: checked ? 'Online payments enabled' : 'Online payments disabled',
        description: checked 
          ? 'Clients can now pay your invoices online.' 
          : 'The Pay Online button will no longer appear on your invoices.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const handleStripeConnect = () => {
    initiateConnect(business.id);
  };

  const handlePaystackSetup = async () => {
    if (!bankCode || !accountNumber) {
      toast({ title: 'Missing fields', description: 'Please select a bank and enter your account number.', variant: 'destructive' });
      return;
    }
    const result = await createSubaccount(business.id, bankCode, accountNumber, business.name);
    if (result) {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setBankCode('');
      setAccountNumber('');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-200"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'restricted':
        return <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 border-orange-200"><AlertCircle className="h-3 w-3 mr-1" /> Restricted</Badge>;
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Online Payments
        </CardTitle>
        <CardDescription>
          Let clients pay invoices online and receive funds directly into your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upgrade prompt for free tier */}
        {isFreeStarterTier && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Upgrade to accept online payments</p>
            <p className="text-xs text-muted-foreground">
              Online payments are available on paid plans. Upgrade to let clients pay your invoices instantly via card.
            </p>
            <Button size="sm" variant="default" asChild>
              <Link to={`/b/${business.id}/billing`}>
                Upgrade Plan <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        )}

        {/* Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Enable online payments</p>
            <p className="text-xs text-muted-foreground">
              {isFreeStarterTier
                ? 'Available on paid plans only.'
                : 'A "Pay Online" button will appear on your public invoice pages.'}
            </p>
          </div>
          <Switch
            checked={!isFreeStarterTier && (business.online_payments_enabled || false)}
            onCheckedChange={handleTogglePayments}
            disabled={isFreeStarterTier}
          />
        </div>

        <Separator />

        {/* Payment Flow Transparency */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">How payments reach you</p>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { step: '1', icon: CreditCard, title: 'Client pays', desc: 'Client clicks "Pay Now" on your invoice and pays via card' },
              { step: '2', icon: Coins, title: 'Platform fee deducted', desc: 'A small platform fee is deducted automatically' },
              { step: '3', icon: Banknote, title: 'You receive funds', desc: 'The rest is settled directly into your connected account' },
            ].map((s) => (
              <div key={s.step} className="flex gap-3 rounded-lg border border-dashed p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {s.step}
                </span>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Payout Setup */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Payout Setup</p>

          {/* Stripe Connect — for non-NGN or all businesses */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Stripe Connect</span>
                <span className="text-xs text-muted-foreground">(International payments)</span>
              </div>
              {getStatusBadge(stripeStatus)}
            </div>
            
            {stripeStatus === 'active' ? (
              <p className="text-xs text-muted-foreground">
                International payments are settled directly to your Stripe account.
              </p>
            ) : stripeStatus === 'pending' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Your Stripe account is being set up. Complete onboarding to start receiving payments.
                </p>
                <Button size="sm" variant="outline" onClick={handleStripeConnect} disabled={connectLoading}>
                  {connectLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  Continue Setup
                </Button>
              </div>
            ) : stripeStatus === 'restricted' ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-600">
                  Your Stripe account needs attention. Some requirements need to be met.
                </p>
                <Button size="sm" variant="outline" onClick={handleStripeConnect} disabled={connectLoading}>
                  {connectLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  Resolve Issues
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connect a Stripe account to receive international payments directly. Stripe handles identity verification.
                </p>
                <Button size="sm" onClick={handleStripeConnect} disabled={connectLoading}>
                  {connectLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Connect Stripe Account
                </Button>
              </div>
            )}
          </div>

          {/* Paystack Subaccount — for Nigerian businesses */}
          {isNigerian && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Bank Account</span>
                  <span className="text-xs text-muted-foreground">(NGN payments via Paystack)</span>
                </div>
                {getStatusBadge(paystackStatus)}
              </div>

              {paystackStatus === 'active' ? (
                <p className="text-xs text-muted-foreground">
                  NGN payments are settled directly to your bank account via Paystack.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Add your Nigerian bank account to receive NGN payments directly.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bank" className="text-xs">Bank</Label>
                      <Select value={bankCode} onValueChange={setBankCode}>
                        <SelectTrigger id="bank">
                          <SelectValue placeholder="Select bank..." />
                        </SelectTrigger>
                        <SelectContent>
                          {NIGERIAN_BANKS.map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>
                              {bank.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="accountNumber" className="text-xs">Account Number</Label>
                      <Input
                        id="accountNumber"
                        placeholder="0123456789"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={handlePaystackSetup} disabled={paystackLoading || !bankCode || !accountNumber}>
                    {paystackLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    Verify & Connect
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Warning: payments enabled but Connect not active */}
        {!isFreeStarterTier && business.online_payments_enabled && stripeStatus !== 'active' && paystackStatus !== 'active' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Online payments are enabled but your payout account is not connected. Clients cannot pay until setup is complete.
            </p>
          </div>
        )}

        {/* Status message */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            {(stripeStatus === 'active' || paystackStatus === 'active')
              ? '✓ Payments are processed securely via Stripe. Funds go directly to your account.'
              : 'Connect your payout account above to start receiving payments directly.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
