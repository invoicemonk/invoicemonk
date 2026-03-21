import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminPartnerReferrals, useAdminPartnerCommissions, useMarkPayoutPaid } from '@/hooks/use-admin-partners';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CheckCircle, Loader2, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PartnerDetailSheetProps {
  partner: {
    id: string;
    name: string;
    email: string;
    commission_rate: number;
    status: string;
    payout_method: string | null;
    created_at: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartnerDetailSheet({ partner, open, onOpenChange }: PartnerDetailSheetProps) {
  const { data: referrals, isLoading: refsLoading } = useAdminPartnerReferrals(partner?.id);
  const { data: commissions, isLoading: commsLoading } = useAdminPartnerCommissions(partner?.id);

  if (!partner) return null;

  const selfReferralCount = referrals?.filter((r) => r.is_self_referral).length || 0;
  const totalReferrals = referrals?.length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{partner.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Partner Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{partner.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span>{(Number(partner.commission_rate) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={partner.status === 'active' ? 'default' : 'destructive'}>
                {partner.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payout Method</span>
              <span className="capitalize">{partner.payout_method || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(partner.created_at), 'dd MMM yyyy')}</span>
            </div>
          </div>

          {/* Fraud indicators */}
          {selfReferralCount > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
              ⚠️ <strong>{selfReferralCount}</strong> self-referral(s) detected out of {totalReferrals} total
            </div>
          )}

          <Separator />

          {/* Referrals */}
          <div>
            <h3 className="font-semibold mb-3">Referrals ({totalReferrals})</h3>
            {refsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !referrals || referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrals</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Self?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.slice(0, 20).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.customer_ref}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(r.attributed_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {r.is_self_referral && (
                          <Badge variant="destructive" className="text-xs">Yes</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Separator />

          {/* Commissions */}
          <div>
            <h3 className="font-semibold mb-3">Recent Commissions</h3>
            {commsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !commissions || commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commissions</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.slice(0, 20).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">
                        {format(new Date(c.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {Number(c.commission_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs">{c.currency}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <Separator />

          {/* Payout Batches with Mark as Paid */}
          <PayoutBatchesSection partnerId={partner.id} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PayoutBatchesSection({ partnerId }: { partnerId: string }) {
  const markPaid = useMarkPayoutPaid();
  const [paymentRef, setPaymentRef] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['admin-partner-payouts', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_batches')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });

  const handleMarkPaid = async (batchId: string) => {
    try {
      await markPaid.mutateAsync({ batchId, paymentReference: paymentRef || undefined });
      toast({ title: 'Payout marked as paid' });
      setMarkingId(null);
      setPaymentRef('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Payout Batches ({batches?.length || 0})
      </h3>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !batches || batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payout batches</p>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">
                    {Number(batch.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {batch.currency}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {format(new Date(batch.created_at), 'dd MMM yyyy')}
                  </span>
                </div>
                <Badge variant={batch.status === 'paid' ? 'default' : 'secondary'}>
                  {batch.status}
                </Badge>
              </div>
              {batch.payment_reference && (
                <p className="text-xs text-muted-foreground font-mono">Ref: {batch.payment_reference}</p>
              )}
              {batch.status === 'draft' && (
                <>
                  {markingId === batch.id ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Payment reference (optional)"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        className="text-sm h-8"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleMarkPaid(batch.id)}
                        disabled={markPaid.isPending}
                      >
                        {markPaid.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMarkingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setMarkingId(batch.id)}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Mark as Paid
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
