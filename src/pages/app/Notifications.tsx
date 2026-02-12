import { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Filter, 
  Inbox,
  FileText,
  CreditCard,
  AlertCircle,
  Mail,
  UserPlus,
  Ban,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  useNotifications, 
  useUnreadCount, 
  useMarkAsRead,
  useMarkAllAsRead,
  NotificationType 
} from '@/hooks/use-notifications';

const iconMap: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  INVOICE_ISSUED: FileText,
  PAYMENT_RECEIVED: CreditCard,
  INVOICE_OVERDUE: AlertCircle,
  INVOICE_SENT: Mail,
  INVOICE_VOIDED: Ban,
  INVOICE_VIEWED: Eye,
  CLIENT_ADDED: UserPlus,
};

const colorMap: Record<NotificationType, string> = {
  INVOICE_ISSUED: 'text-blue-500 bg-blue-50',
  PAYMENT_RECEIVED: 'text-green-500 bg-green-50',
  INVOICE_OVERDUE: 'text-red-500 bg-red-50',
  INVOICE_SENT: 'text-purple-500 bg-purple-50',
  INVOICE_VOIDED: 'text-orange-500 bg-orange-50',
  INVOICE_VIEWED: 'text-indigo-500 bg-indigo-50',
  CLIENT_ADDED: 'text-cyan-500 bg-cyan-50',
};

type FilterType = 'all' | 'unread' | 'invoices' | 'payments';

export default function Notifications() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const { data: notifications = [], isLoading } = useNotifications(100, currentBusiness?.id);
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'invoices') return ['INVOICE_ISSUED', 'INVOICE_SENT', 'INVOICE_OVERDUE', 'INVOICE_VOIDED'].includes(notification.type);
    if (filter === 'payments') return notification.type === 'PAYMENT_RECEIVED';
    return true;
  });

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    
    // Navigate to entity
    if (notification.entity_type === 'invoice' && notification.entity_id) {
      navigate(`/invoices/${notification.entity_id}`);
    } else if (notification.entity_type === 'payment' && notification.entity_id) {
      navigate(`/invoices/${notification.entity_id}`);
    } else if (notification.entity_type === 'client' && notification.entity_id) {
      navigate(`/clients/${notification.entity_id}`);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleMarkSelectedAsRead = async () => {
    for (const id of selectedIds) {
      await markAsRead.mutateAsync(id);
    }
    setSelectedIds(new Set());
  };

  const Icon = (type: string) => iconMap[type as NotificationType] || Bell;
  const colorClass = (type: string) => colorMap[type as NotificationType] || 'text-gray-500 bg-gray-50';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkSelectedAsRead}
              disabled={markAsRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark {selectedIds.size} as read
            </Button>
          )}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1">
            <Filter className="h-3 w-3" />
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-1">
            Unread
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1">
            <FileText className="h-3 w-3" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-3 w-3" />
            Payments
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
            </CardTitle>
            {filteredNotifications.length > 0 && (
              <Checkbox
                checked={selectedIds.size === filteredNotifications.length}
                onCheckedChange={handleSelectAll}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm mt-1">
                {filter === 'unread' 
                  ? "You're all caught up!" 
                  : 'Notifications will appear here when there are updates.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification) => {
                const NotifIcon = Icon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-muted/50',
                      !notification.is_read && 'bg-primary/5'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <Checkbox
                      checked={selectedIds.has(notification.id)}
                      onCheckedChange={(checked) => handleSelectOne(notification.id, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className={cn('p-2 rounded-lg', colorClass(notification.type))}>
                      <NotifIcon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn('font-medium', !notification.is_read && 'text-foreground')}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
