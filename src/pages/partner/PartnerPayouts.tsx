import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePayouts } from '@/hooks/use-payouts';
import { Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const statusVariant = (status: string) => {
  switch (status) {
    case 'draft': return 'outline' as const;
    case 'processing': return 'secondary' as const;
    case 'paid': return 'default' as const;
    case 'cancelled': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

const PartnerPayouts = () => {
  const { data: payouts, isLoading } = usePayouts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payouts</h1>
        <p className="text-muted-foreground mt-1">Your payout history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payout History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !payouts || payouts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No payouts yet. Payouts are processed by the admin team after commissions are locked.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(p.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(p.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {p.payment_method || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {p.payment_reference || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
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

export default PartnerPayouts;
