import { useState } from 'react';
import { Bell, Users, CreditCard, MessageCircle, ShieldAlert, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useAdminNotifications, 
  useAdminUnreadCount,
  useAdminMarkAllAsRead,
  AdminNotificationCategory 
} from '@/hooks/use-admin-notifications';
import { AdminNotificationItem } from '@/components/admin/AdminNotificationItem';

const categoryTabs: { value: AdminNotificationCategory | 'all'; label: string; icon: typeof Users }[] = [
  { value: 'all', label: 'All', icon: Bell },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'support', label: 'Support', icon: MessageCircle },
  { value: 'compliance', label: 'Compliance', icon: ShieldAlert },
];

export default function AdminNotifications() {
  const [activeTab, setActiveTab] = useState<AdminNotificationCategory | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Fetch notifications based on category
  const category = activeTab === 'all' ? undefined : activeTab;
  const { data: notifications = [], isLoading } = useAdminNotifications(100, category);
  const { data: unreadCount = 0 } = useAdminUnreadCount();
  const markAllAsRead = useAdminMarkAllAsRead();

  // Filter by unread if toggle is on
  const filteredNotifications = showUnreadOnly 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Platform-wide alerts and operational events
          </p>
        </div>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {categoryTabs.slice(1).map((cat) => {
          const categoryNotifications = notifications.filter(n => {
            const catTypes = {
              users: ['ADMIN_USER_REGISTERED', 'ADMIN_EMAIL_VERIFIED'],
              billing: ['ADMIN_SUBSCRIPTION_UPGRADED', 'ADMIN_SUBSCRIPTION_DOWNGRADED', 'ADMIN_PAYMENT_FAILED', 'ADMIN_FIRST_INVOICE_ISSUED'],
              support: ['SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_USER_REPLY'],
              compliance: ['ADMIN_EXPORT_FAILED', 'ADMIN_VERIFICATION_FAILED'],
            };
            return catTypes[cat.value as AdminNotificationCategory]?.includes(n.type);
          });
          const unread = categoryNotifications.filter(n => !n.is_read).length;

          return (
            <Card 
              key={cat.value} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setActiveTab(cat.value as AdminNotificationCategory)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{cat.label}</CardTitle>
                <cat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{categoryNotifications.length}</div>
                {unread > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unread} unread
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification Center</CardTitle>
              <CardDescription>
                View and manage platform notifications
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="unread-only"
                checked={showUnreadOnly}
                onCheckedChange={setShowUnreadOnly}
              />
              <Label htmlFor="unread-only" className="text-sm">
                Unread only
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              {categoryTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No notifications</p>
                    <p className="text-sm">
                      {showUnreadOnly 
                        ? 'No unread notifications in this category'
                        : 'No notifications to display'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredNotifications.map((notification) => (
                      <AdminNotificationItem
                        key={notification.id}
                        notification={notification}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
