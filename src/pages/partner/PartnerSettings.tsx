import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePartnerContext } from '@/contexts/PartnerContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Settings, Loader2 } from 'lucide-react';

const PartnerSettings = () => {
  const { partner, refreshPartner } = usePartnerContext();
  const [saving, setSaving] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState(partner?.payout_method || '');
  const [payoutDetails, setPayoutDetails] = useState<Record<string, string>>(
    (partner?.payout_details as Record<string, string>) || {}
  );

  const handleSave = async () => {
    if (!partner?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('referral_partners')
        .update({
          payout_method: payoutMethod || null,
          payout_details: payoutDetails,
        })
        .eq('id', partner.id);

      if (error) throw error;
      await refreshPartner();
      toast({ title: 'Payout details updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateDetail = (key: string, value: string) => {
    setPayoutDetails((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Partner Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your payout preferences</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Payout Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select payout method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="wise">Wise</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payoutMethod === 'bank' && (
            <>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={payoutDetails.bank_name || ''}
                  onChange={(e) => updateDetail('bank_name', e.target.value)}
                  placeholder="e.g. Access Bank"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={payoutDetails.account_number || ''}
                  onChange={(e) => updateDetail('account_number', e.target.value)}
                  placeholder="Account number"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input
                  value={payoutDetails.account_name || ''}
                  onChange={(e) => updateDetail('account_name', e.target.value)}
                  placeholder="Account holder name"
                />
              </div>
            </>
          )}

          {payoutMethod === 'wise' && (
            <div className="space-y-2">
              <Label>Wise Email</Label>
              <Input
                value={payoutDetails.wise_email || ''}
                onChange={(e) => updateDetail('wise_email', e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          )}

          {payoutMethod === 'paypal' && (
            <div className="space-y-2">
              <Label>PayPal Email</Label>
              <Input
                value={payoutDetails.paypal_email || ''}
                onChange={(e) => updateDetail('paypal_email', e.target.value)}
                placeholder="your@paypal.com"
              />
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Payout Details
          </Button>
        </CardContent>
      </Card>

      {/* Read-only info */}
      {partner && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Partner Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{partner.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{partner.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commission Rate</span>
              <span className="font-medium">{(partner.commission_rate * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{partner.status}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartnerSettings;
