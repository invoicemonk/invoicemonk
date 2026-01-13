import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  History, 
  Search, 
  Filter, 
  Download,
  User,
  Clock,
  Shield,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminAuditLogs } from '@/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type AuditEventType = Database['public']['Enums']['audit_event_type'];

const eventTypeLabels: Record<string, string> = {
  USER_LOGIN: 'User Login',
  USER_LOGOUT: 'User Logout',
  USER_SIGNUP: 'User Signup',
  EMAIL_VERIFIED: 'Email Verified',
  PASSWORD_RESET: 'Password Reset',
  INVOICE_CREATED: 'Invoice Created',
  INVOICE_UPDATED: 'Invoice Updated',
  INVOICE_ISSUED: 'Invoice Issued',
  INVOICE_SENT: 'Invoice Sent',
  INVOICE_VIEWED: 'Invoice Viewed',
  INVOICE_VOIDED: 'Invoice Voided',
  INVOICE_CREDITED: 'Invoice Credited',
  PAYMENT_RECORDED: 'Payment Recorded',
  CLIENT_CREATED: 'Client Created',
  CLIENT_UPDATED: 'Client Updated',
  BUSINESS_CREATED: 'Business Created',
  BUSINESS_UPDATED: 'Business Updated',
  TEAM_MEMBER_ADDED: 'Team Member Added',
  TEAM_MEMBER_REMOVED: 'Team Member Removed',
  ROLE_CHANGED: 'Role Changed',
  DATA_EXPORTED: 'Data Exported',
  SUBSCRIPTION_CHANGED: 'Subscription Changed',
  SETTINGS_UPDATED: 'Settings Updated',
};

export default function AdminAuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<AuditEventType | 'all'>('all');
  const { data: logs, isLoading } = useAdminAuditLogs(searchQuery || undefined, eventFilter);

  const getEventBadgeVariant = (eventType: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (eventType.includes('VOIDED') || eventType.includes('REMOVED')) return 'destructive';
    if (eventType.includes('CREATED') || eventType.includes('ADDED')) return 'default';
    if (eventType.includes('UPDATED') || eventType.includes('CHANGED')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Audit Logs</h1>
          <p className="text-muted-foreground">Platform-wide immutable activity records</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Immutability Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4"
      >
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">Immutable System Logs</p>
            <p className="text-sm text-green-600 dark:text-green-400">
              These records cannot be modified or deleted by anyone, including platform admins. 
              Each entry includes a cryptographic hash for tamper detection.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as AuditEventType | 'all')}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="USER_LOGIN">User Login</SelectItem>
                <SelectItem value="USER_SIGNUP">User Signup</SelectItem>
                <SelectItem value="INVOICE_CREATED">Invoice Created</SelectItem>
                <SelectItem value="INVOICE_ISSUED">Invoice Issued</SelectItem>
                <SelectItem value="INVOICE_VOIDED">Invoice Voided</SelectItem>
                <SelectItem value="PAYMENT_RECORDED">Payment Recorded</SelectItem>
                <SelectItem value="ROLE_CHANGED">Role Changed</SelectItem>
                <SelectItem value="SUBSCRIPTION_CHANGED">Subscription Changed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Showing {logs?.length || 0} records (limited to 500)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp (UTC)</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="hidden lg:table-cell">Business</TableHead>
                <TableHead className="hidden xl:table-cell">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(15)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No audit logs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-mono">
                          {format(new Date(log.timestamp_utc), 'MMM d, HH:mm:ss')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getEventBadgeVariant(log.event_type)}>
                        {eventTypeLabels[log.event_type] || log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium capitalize text-sm">{log.entity_type.toLowerCase()}</p>
                        {log.entity_id && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.entity_id.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm capitalize">{log.actor_role || 'system'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {log.business_id ? (
                        <span className="text-xs font-mono text-muted-foreground">
                          {log.business_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {log.event_hash ? (
                        <code className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded">
                          {log.event_hash.slice(0, 12)}...
                        </code>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
