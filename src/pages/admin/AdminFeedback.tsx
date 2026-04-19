import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, UserX } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ChurnRow {
  id: string;
  user_id: string;
  previous_tier: string;
  new_tier: string;
  reason: string;
  details: string | null;
  created_at: string;
}

interface InactiveRow {
  id: string;
  user_id: string;
  created_at: string;
  metadata: any;
}

const REASON_LABELS: Record<string, string> = {
  too_expensive: 'Too expensive',
  missing_features: 'Missing features',
  not_using_enough: 'Not using enough',
  switching_competitor: 'Switching tool',
  business_changed: 'Business changed',
  other: 'Other',
  dismissed: 'Dismissed',
};

export default function AdminFeedback() {
  const { data: churn, isLoading: churnLoading } = useQuery({
    queryKey: ['admin-churn-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churn_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as ChurnRow[];
    },
  });

  const { data: inactive, isLoading: inactiveLoading } = useQuery({
    queryKey: ['admin-inactive-checkins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lifecycle_events')
        .select('id, user_id, created_at, metadata')
        .eq('event_type', 'inactive_user_checkin')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as InactiveRow[];
    },
  });

  const reasonCounts = (churn || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.reason] = (acc[row.reason] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground mt-1">
          Churn reasons and inactive-user signals
        </p>
      </div>

      <Tabs defaultValue="churn" className="space-y-4">
        <TabsList>
          <TabsTrigger value="churn" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Churn Reasons
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-2">
            <UserX className="h-4 w-4" />
            Inactive Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="churn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reason breakdown</CardTitle>
              <CardDescription>Why subscribers downgraded</CardDescription>
            </CardHeader>
            <CardContent>
              {churnLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : Object.keys(reasonCounts).length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(reasonCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => {
                      const total = churn?.length || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={reason} className="flex items-center gap-3">
                          <div className="w-40 text-sm">{REASON_LABELS[reason] || reason}</div>
                          <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-16 text-sm text-right text-muted-foreground">
                            {count} ({pct}%)
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All responses</CardTitle>
            </CardHeader>
            <CardContent>
              {churnLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From → To</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(churn || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(row.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.previous_tier} → {row.new_tier}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {REASON_LABELS[row.reason] || row.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-md">
                          {row.details || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!churn || churn.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No responses yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inactive-user check-ins sent</CardTitle>
              <CardDescription>
                Users emailed because they registered but didn't issue an invoice
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inactiveLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Days since signup</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(inactive || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs font-mono">{row.user_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.metadata?.days_since_signup ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!inactive || inactive.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No check-ins sent yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
