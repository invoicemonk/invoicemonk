import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCommissions } from '@/hooks/use-commissions';
import { Coins } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const statusVariant = (status: string) => {
  switch (status) {
    case 'pending': return 'outline' as const;
    case 'locked': return 'secondary' as const;
    case 'paid': return 'default' as const;
    case 'voided': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

const PartnerCommissions = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: commissions, isLoading } = useCommissions(statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commissions</h1>
          <p className="text-muted-foreground mt-1">Track your commission earnings</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Commission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !commissions || commissions.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No commissions yet. Commissions are generated when your referred customers pay for their subscriptions.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Gross Amount</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(c.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {Number(c.gross_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(Number(c.commission_rate) * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(c.commission_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.currency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
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

export default PartnerCommissions;
