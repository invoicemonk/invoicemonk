import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePartnerReferralsEnriched } from '@/hooks/use-partner';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const PartnerReferrals = () => {
  const { data: referrals, isLoading } = usePartnerReferralsEnriched();

  const getStatusBadge = (ref: NonNullable<typeof referrals>[number]) => {
    if (!ref.commission_business_id) {
      return <Badge variant="secondary">Signed Up</Badge>;
    }
    if (ref.subscription_status === 'cancelled' || ref.subscription_status === 'past_due') {
      return <Badge variant="destructive">Churned</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referrals</h1>
        <p className="text-muted-foreground mt-1">Customers you've referred to Invoicemonk</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referred Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !referrals || referrals.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No referrals yet. Share your referral link to start earning commissions.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Ref</TableHead>
                  <TableHead>Signup Month</TableHead>
                  <TableHead>Current Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Lifetime Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-mono font-medium">{ref.customer_ref}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ref.attributed_at ? format(new Date(ref.attributed_at), 'MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {ref.subscription_tier ? (
                        <Badge variant="outline" className="capitalize">{ref.subscription_tier}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(ref)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {ref.lifetime_commission > 0
                        ? `${ref.commission_currency || ''} ${ref.lifetime_commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerReferrals;
