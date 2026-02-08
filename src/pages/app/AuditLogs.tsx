import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  History, 
  Search,
  Filter,
  Shield,
  Clock,
  User,
  FileText,
  CreditCard,
  Settings,
  Lock,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { UpgradePrompt } from '@/components/app/UpgradePrompt';

type AuditEventType = 
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_SIGNUP'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_SENT'
  | 'INVOICE_VIEWED'
  | 'INVOICE_VOIDED'
  | 'INVOICE_CREDITED'
  | 'PAYMENT_RECORDED'
  | 'CLIENT_CREATED'
  | 'CLIENT_UPDATED'
  | 'BUSINESS_CREATED'
  | 'BUSINESS_UPDATED'
  | 'TEAM_MEMBER_ADDED'
  | 'TEAM_MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'DATA_EXPORTED'
  | 'SUBSCRIPTION_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'ACCOUNT_CLOSED';

const eventTypeConfig: Record<string, { label: string; icon: typeof History; color: string }> = {
  USER_LOGIN: { label: 'User Login', icon: User, color: 'bg-blue-500/10 text-blue-600' },
  USER_LOGOUT: { label: 'User Logout', icon: User, color: 'bg-muted text-muted-foreground' },
  USER_SIGNUP: { label: 'User Signup', icon: User, color: 'bg-emerald-500/10 text-emerald-600' },
  EMAIL_VERIFIED: { label: 'Email Verified', icon: Shield, color: 'bg-emerald-500/10 text-emerald-600' },
  PASSWORD_RESET: { label: 'Password Reset', icon: Lock, color: 'bg-amber-500/10 text-amber-600' },
  INVOICE_CREATED: { label: 'Invoice Created', icon: FileText, color: 'bg-emerald-500/10 text-emerald-600' },
  INVOICE_UPDATED: { label: 'Invoice Updated', icon: FileText, color: 'bg-blue-500/10 text-blue-600' },
  INVOICE_ISSUED: { label: 'Invoice Issued', icon: Lock, color: 'bg-purple-500/10 text-purple-600' },
  INVOICE_SENT: { label: 'Invoice Sent', icon: FileText, color: 'bg-amber-500/10 text-amber-600' },
  INVOICE_VIEWED: { label: 'Invoice Viewed', icon: FileText, color: 'bg-muted text-muted-foreground' },
  INVOICE_VOIDED: { label: 'Invoice Voided', icon: FileText, color: 'bg-red-500/10 text-red-600' },
  INVOICE_CREDITED: { label: 'Invoice Credited', icon: FileText, color: 'bg-amber-500/10 text-amber-600' },
  PAYMENT_RECORDED: { label: 'Payment Recorded', icon: CreditCard, color: 'bg-emerald-500/10 text-emerald-600' },
  CLIENT_CREATED: { label: 'Client Created', icon: User, color: 'bg-blue-500/10 text-blue-600' },
  CLIENT_UPDATED: { label: 'Client Updated', icon: User, color: 'bg-muted text-muted-foreground' },
  BUSINESS_CREATED: { label: 'Business Created', icon: Settings, color: 'bg-purple-500/10 text-purple-600' },
  BUSINESS_UPDATED: { label: 'Business Updated', icon: Settings, color: 'bg-muted text-muted-foreground' },
  TEAM_MEMBER_ADDED: { label: 'Team Member Added', icon: User, color: 'bg-emerald-500/10 text-emerald-600' },
  TEAM_MEMBER_REMOVED: { label: 'Team Member Removed', icon: User, color: 'bg-red-500/10 text-red-600' },
  ROLE_CHANGED: { label: 'Role Changed', icon: Shield, color: 'bg-amber-500/10 text-amber-600' },
  DATA_EXPORTED: { label: 'Data Exported', icon: FileText, color: 'bg-purple-500/10 text-purple-600' },
  SUBSCRIPTION_CHANGED: { label: 'Subscription Changed', icon: CreditCard, color: 'bg-amber-500/10 text-amber-600' },
  SETTINGS_UPDATED: { label: 'Settings Updated', icon: Settings, color: 'bg-muted text-muted-foreground' },
  ACCOUNT_CLOSED: { label: 'Account Closed', icon: Lock, color: 'bg-red-500/10 text-red-600' },
};

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  
  const { currentBusiness, canAccess, loading: subscriptionLoading } = useBusiness();
  const hasAuditAccess = canAccess('audit_logs_visible');
  
  const { data: auditLogs, isLoading: logsLoading } = useAuditLogs({ 
    limit: 200,
    businessId: currentBusiness?.id 
  });

  const filteredLogs = (auditLogs || []).filter(log => {
    if (eventFilter !== 'all' && log.event_type !== eventFilter) return false;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesEntity = log.entity_type?.toLowerCase().includes(searchLower);
      const matchesEventType = log.event_type?.toLowerCase().includes(searchLower);
      if (!matchesEntity && !matchesEventType) return false;
    }
    return true;
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Show upgrade prompt if user doesn't have access
  if (!subscriptionLoading && !hasAuditAccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of all account activity
          </p>
        </div>
        
        <UpgradePrompt 
          feature="Audit Logs"
          title="Access Full Audit Trail"
          description="View your complete, immutable audit trail with Professional. Track every action for compliance and accountability."
          requiredTier="professional"
          variant="card"
          className="max-w-xl mx-auto mt-12"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of all account activity
          </p>
        </div>
        <Badge variant="secondary" className="w-fit flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Read-Only
        </Badge>
      </div>

      {/* Security Notice */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-center gap-4 py-4">
          <Lock className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-medium">Immutable Audit Trail</p>
            <p className="text-sm text-muted-foreground">
              This log is append-only and cannot be modified or deleted. Every action in your account 
              is permanently recorded for compliance and accountability.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by entity or event type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="USER_LOGIN">User Logins</SelectItem>
                <SelectItem value="INVOICE_CREATED">Invoice Created</SelectItem>
                <SelectItem value="INVOICE_ISSUED">Invoice Issued</SelectItem>
                <SelectItem value="INVOICE_VOIDED">Invoice Voided</SelectItem>
                <SelectItem value="PAYMENT_RECORDED">Payments</SelectItem>
                <SelectItem value="CLIENT_CREATED">Clients</SelectItem>
                <SelectItem value="DATA_EXPORTED">Data Exports</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        {logsLoading ? (
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </CardContent>
        ) : filteredLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor Role</TableHead>
                <TableHead>Timestamp (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const config = eventTypeConfig[log.event_type] || {
                  label: log.event_type,
                  icon: History,
                  color: 'bg-muted text-muted-foreground'
                };
                const Icon = config.icon;
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="secondary" className={config.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="text-muted-foreground text-xs ml-1">
                            #{String(log.entity_id).slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{log.actor_role || 'user'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(log.timestamp_utc)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-muted mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No audit logs yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Your activity will be recorded here as you use the platform. 
              All actions are permanently logged for compliance.
            </p>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
