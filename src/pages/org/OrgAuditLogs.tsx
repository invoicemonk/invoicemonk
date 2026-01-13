import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  History, 
  Search, 
  Filter, 
  Download,
  User,
  FileText,
  Users,
  Settings,
  CreditCard,
  Shield,
  Clock,
  Eye
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
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationAuditLogs } from '@/hooks/use-organization';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const eventTypeIcons: Record<string, typeof User> = {
  USER_LOGIN: User,
  USER_LOGOUT: User,
  USER_SIGNUP: User,
  EMAIL_VERIFIED: User,
  PASSWORD_RESET: User,
  INVOICE_CREATED: FileText,
  INVOICE_UPDATED: FileText,
  INVOICE_ISSUED: FileText,
  INVOICE_SENT: FileText,
  INVOICE_VIEWED: Eye,
  INVOICE_VOIDED: FileText,
  INVOICE_CREDITED: FileText,
  PAYMENT_RECORDED: CreditCard,
  CLIENT_CREATED: Users,
  CLIENT_UPDATED: Users,
  BUSINESS_CREATED: Settings,
  BUSINESS_UPDATED: Settings,
  TEAM_MEMBER_ADDED: Users,
  TEAM_MEMBER_REMOVED: Users,
  ROLE_CHANGED: Shield,
  DATA_EXPORTED: Download,
  SUBSCRIPTION_CHANGED: CreditCard,
  SETTINGS_UPDATED: Settings,
};

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

export default function OrgAuditLogs() {
  const { orgId } = useParams();
  const { currentOrg, isAuditor } = useOrganization();
  const { data: logs, isLoading } = useOrganizationAuditLogs(orgId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = 
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEvent = eventFilter === 'all' || log.event_type === eventFilter;
    return matchesSearch && matchesEvent;
  });

  const getEventIcon = (eventType: string) => {
    const Icon = eventTypeIcons[eventType] || History;
    return <Icon className="h-4 w-4" />;
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Immutable record of all organization activity</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Compliance Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4"
      >
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">Immutable Audit Trail</p>
            <p className="text-sm text-green-600 dark:text-green-400">
              These records cannot be modified or deleted. Every action is permanently logged with timestamps, 
              actor information, and state changes for compliance purposes.
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
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="INVOICE_CREATED">Invoice Created</SelectItem>
                <SelectItem value="INVOICE_ISSUED">Invoice Issued</SelectItem>
                <SelectItem value="INVOICE_VOIDED">Invoice Voided</SelectItem>
                <SelectItem value="PAYMENT_RECORDED">Payment Recorded</SelectItem>
                <SelectItem value="TEAM_MEMBER_ADDED">Team Member Added</SelectItem>
                <SelectItem value="TEAM_MEMBER_REMOVED">Team Member Removed</SelectItem>
                <SelectItem value="ROLE_CHANGED">Role Changed</SelectItem>
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
            Showing {filteredLogs?.length || 0} of {logs?.length || 0} records
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp (UTC)</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="hidden md:table-cell">Actor</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No audit logs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(log.timestamp_utc), 'MMM d, yyyy HH:mm:ss')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(log.event_type)}
                        <Badge variant={getEventBadgeVariant(log.event_type)}>
                          {eventTypeLabels[log.event_type] || log.event_type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium capitalize">{log.entity_type.toLowerCase()}</p>
                        {log.entity_id && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.entity_id.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {log.actor_role || 'System'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {log.metadata ? (
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {typeof log.metadata === 'object' 
                            ? JSON.stringify(log.metadata).slice(0, 50) + '...'
                            : String(log.metadata)
                          }
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Hash Verification Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-muted bg-muted/30 p-4"
      >
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Tamper-Proof Records</p>
            <p className="text-sm text-muted-foreground">
              Each audit log entry includes a cryptographic hash that can be verified for integrity. 
              Any attempt to modify records would break the hash chain, providing evidence of tampering.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
