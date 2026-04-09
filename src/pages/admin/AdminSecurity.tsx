import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Users, 
  FileText, 
  ArrowRight,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminFraudFlags } from '@/hooks/use-admin-fraud-flags';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function AdminSecurity() {
  // Fraud flags (unresolved)
  const { data: unresolvedFlags, isLoading: flagsLoading } = useAdminFraudFlags({ resolved: false });

  // Summary stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-security-stats'],
    queryFn: async () => {
      const [flagsRes, unverifiedRes, flaggedBizRes, recentAuthRes] = await Promise.all([
        supabase.from('fraud_flags' as any).select('*', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('businesses').select('*', { count: 'exact', head: true }).neq('verification_status', 'verified'),
        supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true })
          .in('event_type', ['USER_LOGIN', 'USER_SIGNUP'] as any[])
          .gte('timestamp_utc', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        openFraudFlags: flagsRes.count || 0,
        unverifiedBusinesses: unverifiedRes.count || 0,
        flaggedBusinesses: flaggedBizRes.count || 0,
        recentAuthEvents: recentAuthRes.count || 0,
      };
    },
  });

  // Recent auth events
  const { data: recentEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin-recent-auth-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, event_type, user_id, source_ip, user_agent, timestamp_utc, metadata')
        .in('event_type', ['USER_LOGIN', 'USER_SIGNUP'] as any[])
        .order('timestamp_utc', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = flagsLoading || statsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Overview</h1>
        <p className="text-muted-foreground">Consolidated view of platform security and abuse signals</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-10" /> : stats?.openFraudFlags}</p>
                  <p className="text-sm text-muted-foreground">Open Fraud Flags</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-10" /> : stats?.unverifiedBusinesses}</p>
                  <p className="text-sm text-muted-foreground">Unverified Businesses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Shield className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-10" /> : stats?.flaggedBusinesses}</p>
                  <p className="text-sm text-muted-foreground">Flagged Businesses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-10" /> : stats?.recentAuthEvents}</p>
                  <p className="text-sm text-muted-foreground">Auth Events (24h)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium">Risk Monitoring</p>
                  <p className="text-sm text-muted-foreground">View fraud flags, resolve alerts</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/risk-monitoring">
                  View <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Verifications</p>
                  <p className="text-sm text-muted-foreground">Review pending documents</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/verifications">
                  View <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open Fraud Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Open Fraud Flags
          </CardTitle>
          <CardDescription>
            {unresolvedFlags?.length || 0} unresolved flags
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagsLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : !unresolvedFlags?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-primary opacity-50" />
                    <p className="text-muted-foreground">No open fraud flags</p>
                  </TableCell>
                </TableRow>
              ) : (
                unresolvedFlags.slice(0, 10).map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-medium">{flag.business_name}</TableCell>
                    <TableCell className="text-sm">{flag.reason}</TableCell>
                    <TableCell>
                      <Badge variant={flag.severity === 'high' ? 'destructive' : flag.severity === 'medium' ? 'default' : 'secondary'}>
                        {flag.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(flag.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Auth Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Recent Auth Events
          </CardTitle>
          <CardDescription>Latest login and signup activity</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : !recentEvents?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No recent auth events
                  </TableCell>
                </TableRow>
              ) : (
                recentEvents.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell>
                      <Badge variant={evt.event_type === 'USER_SIGNUP' ? 'default' : 'secondary'}>
                        {evt.event_type === 'USER_SIGNUP' ? 'Signup' : 'Login'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{evt.user_id?.substring(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-xs">{(evt.source_ip as string) || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(evt.timestamp_utc), 'MMM d, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
