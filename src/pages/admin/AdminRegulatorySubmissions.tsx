import { motion } from 'framer-motion';
import { Shield, Clock, Send, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminSubmissionStats, useAdminSubmissionQueue } from '@/hooks/use-regulatory';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600' },
  queued: { label: 'Queued', className: 'bg-blue-500/10 text-blue-600' },
  submitted: { label: 'Submitted', className: 'bg-blue-500/10 text-blue-600' },
  accepted: { label: 'Accepted', className: 'bg-emerald-500/10 text-emerald-600' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  retrying: { label: 'Retrying', className: 'bg-amber-500/10 text-amber-600' },
};

export default function AdminRegulatorySubmissions() {
  const { data: stats } = useAdminSubmissionStats();
  const { data: queueItems = [] } = useAdminSubmissionQueue();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-submission-queue');
      if (error) throw error;
      toast.success(`Queue processed: ${data?.processed || 0} items`);
      queryClient.invalidateQueries({ queryKey: ['admin-submission-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-stats'] });
    } catch (err) {
      toast.error(`Failed to process queue: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const statCards = [
    { label: 'Pending', count: stats?.statusCounts?.pending || 0, icon: Clock, color: 'text-amber-600' },
    { label: 'Submitted', count: (stats?.statusCounts?.submitted || 0) + (stats?.statusCounts?.queued || 0), icon: Send, color: 'text-blue-600' },
    { label: 'Accepted', count: stats?.statusCounts?.accepted || 0, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Failed', count: (stats?.statusCounts?.failed || 0) + (stats?.statusCounts?.rejected || 0), icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Regulatory Submissions
          </h1>
          <p className="text-muted-foreground">Monitor and manage regulatory submission queue</p>
        </div>
        <Button onClick={handleProcessQueue} disabled={processing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
          Process Queue
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-2xl font-bold">{card.count}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jurisdiction Breakdown */}
      {stats && Object.keys(stats.jurisdictionCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By Jurisdiction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(stats.jurisdictionCounts).map(([jurisdiction, count]) => (
                <div key={jurisdiction} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <span className="font-medium">{jurisdiction}</span>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Items */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Queue</CardTitle>
          <CardDescription>{queueItems.length} items waiting to be processed</CardDescription>
        </CardHeader>
        <CardContent>
          {queueItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueItems.map((item: any) => {
                  const sub = item.regulator_submissions;
                  const badge = statusBadge[sub?.submission_status] || statusBadge.pending;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.submission_id?.slice(0, 8)}…</TableCell>
                      <TableCell>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(item.scheduled_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-destructive">{item.error_message || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Queue is empty</p>
          )}
        </CardContent>
      </Card>

      {/* Total Stats */}
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <p className="text-sm text-muted-foreground">
            Total submissions: <span className="font-bold text-foreground">{stats?.total || 0}</span>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
