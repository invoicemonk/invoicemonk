import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NotificationItem } from './NotificationItem';
import { useNotifications, useUnreadCount, useMarkAllAsRead } from '@/hooks/use-notifications';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { businessId } = useParams<{ businessId: string }>();
  const { data: notifications = [], isLoading } = useNotifications(20);
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllAsRead = useMarkAllAsRead();
  
  const notificationsUrl = businessId ? `/b/${businessId}/notifications` : '/notifications';

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center text-[10px] font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Link 
            to={notificationsUrl}
            onClick={() => setOpen(false)}
            className="block w-full text-center text-sm text-primary hover:underline py-2"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
