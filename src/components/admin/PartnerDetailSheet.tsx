import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminPartnerReferrals, useAdminPartnerCommissions } from '@/hooks/use-admin-partners';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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
        </div>
      </SheetContent>
    </Sheet>
  );
}
