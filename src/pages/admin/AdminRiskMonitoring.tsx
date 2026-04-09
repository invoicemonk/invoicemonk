import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, CheckCircle2, AlertTriangle, Eye, Loader2 } from 'lucide-react';
import { useAdminFraudFlags, type FraudFlag } from '@/hooks/use-admin-fraud-flags';
import { formatDistanceToNow } from 'date-fns';

const severityConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  critical: { variant: 'destructive', label: 'Critical' },
  high: { variant: 'destructive', label: 'High' },
  medium: { variant: 'secondary', label: 'Medium' },
  low: { variant: 'outline', label: 'Low' },
};

const reasonLabels: Record<string, string> = {
  SELF_PAYMENT_ATTEMPT: 'Self-Payment Attempt',
  PAYER_EMAIL_MATCHES_BUSINESS: 'Payer Email Matches Business',
};

export default function AdminRiskMonitoring() {
  const [resolvedFilter, setResolvedFilter] = useState<string>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filters = {
    resolved: resolvedFilter === 'all' ? undefined : resolvedFilter === 'resolved',
    severity: severityFilter === 'all' ? undefined : severityFilter,
  };

  const { data: flags, isLoading, resolveFlag } = useAdminFraudFlags(filters);

  const totalFlags = flags?.length || 0;
  const criticalCount = flags?.filter(f => f.severity === 'critical' || f.severity === 'high').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          Risk Monitoring
        </h1>
        <p className="text-muted-foreground">Track and investigate suspicious payment activity</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Flags</CardDescription>
            <CardTitle className="text-2xl">{totalFlags}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High / Critical</CardDescription>
            <CardTitle className="text-2xl text-destructive">{criticalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-2xl">{resolvedFilter === 'unresolved' ? 'Unresolved' : resolvedFilter === 'resolved' ? 'Resolved' : 'All'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalFlags === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-2" />
              <p>No fraud flags found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags?.map((flag: FraudFlag) => {
                  const config = severityConfig[flag.severity] || severityConfig.medium;
                  return (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {reasonLabels[flag.reason] || flag.reason}
                      </TableCell>
                      <TableCell className="text-sm">{flag.business_name}</TableCell>
                      <TableCell className="text-sm font-mono">{flag.invoice_number || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {flag.resolved ? (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Resolved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Open
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={resolveFlag.isPending}
                          onClick={() => resolveFlag.mutate({ flagId: flag.id, resolved: !flag.resolved })}
                        >
                          {flag.resolved ? 'Reopen' : 'Resolve'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
