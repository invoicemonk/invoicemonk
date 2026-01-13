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
  Lock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

type AuditEventType = 
  | 'USER_LOGIN'
  | 'INVOICE_CREATED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_SENT'
  | 'PAYMENT_RECORDED'
  | 'CLIENT_CREATED'
  | 'SETTINGS_UPDATED';

interface AuditLog {
  id: string;
  eventType: AuditEventType;
  entityType: string;
  entityId?: string;
  timestamp: string;
  actorEmail: string;
  metadata?: Record<string, unknown>;
}

const eventTypeConfig: Record<AuditEventType, { label: string; icon: typeof History; color: string }> = {
  USER_LOGIN: { label: 'User Login', icon: User, color: 'bg-blue-500/10 text-blue-600' },
  INVOICE_CREATED: { label: 'Invoice Created', icon: FileText, color: 'bg-emerald-500/10 text-emerald-600' },
  INVOICE_ISSUED: { label: 'Invoice Issued', icon: Lock, color: 'bg-purple-500/10 text-purple-600' },
  INVOICE_SENT: { label: 'Invoice Sent', icon: FileText, color: 'bg-amber-500/10 text-amber-600' },
  PAYMENT_RECORDED: { label: 'Payment Recorded', icon: CreditCard, color: 'bg-emerald-500/10 text-emerald-600' },
  CLIENT_CREATED: { label: 'Client Created', icon: User, color: 'bg-blue-500/10 text-blue-600' },
  SETTINGS_UPDATED: { label: 'Settings Updated', icon: Settings, color: 'bg-muted text-muted-foreground' },
};

// Placeholder for when we have real data
const auditLogs: AuditLog[] = [];

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter(log => {
    if (eventFilter !== 'all' && log.eventType !== eventFilter) return false;
    if (searchQuery && 
        !log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.entityType.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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
                placeholder="Search by user or entity..."
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
                <SelectItem value="PAYMENT_RECORDED">Payments</SelectItem>
                <SelectItem value="CLIENT_CREATED">Clients</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        {filteredLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Timestamp (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const config = eventTypeConfig[log.eventType];
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
                        <span className="font-medium">{log.entityType}</span>
                        {log.entityId && (
                          <span className="text-muted-foreground text-xs ml-1">
                            #{log.entityId.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{log.actorEmail}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(log.timestamp)}
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
