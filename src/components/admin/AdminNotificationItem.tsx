import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  AdminNotification, 
  getNotificationCategory,
  useAdminMarkAsRead 
} from '@/hooks/use-admin-notifications';
import {
  formatAdminNotificationTime,
  getAdminNotificationConfig,
} from '@/lib/admin-notifications';

interface AdminNotificationItemProps {
  notification: AdminNotification;
  onClose?: () => void;
}

export function AdminNotificationItem({ notification, onClose }: AdminNotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useAdminMarkAsRead();

  const config = getAdminNotificationConfig(notification.type);
  const Icon = config.icon;
  const category = getNotificationCategory(notification.type);

  const handleClick = () => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }

    // Navigate based on entity type and category
    let destination = '/admin/notifications';

    switch (notification.entity_type) {
      case 'user':
        destination = '/admin/users';
        break;
      case 'subscription':
        destination = '/admin/billing';
        break;
      case 'support_ticket':
        destination = '/admin/support';
        break;
      case 'invoice':
        destination = '/admin/invoices';
        break;
      case 'export':
        destination = '/admin/system';
        break;
      default:
        // Fallback based on category
        if (category === 'users') destination = '/admin/users';
        else if (category === 'billing') destination = '/admin/billing';
        else if (category === 'support') destination = '/admin/support';
        else if (category === 'compliance') destination = '/admin/system';
    }

    navigate(destination);
    onClose?.();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 rounded-md',
        !notification.is_read && 'bg-muted/30'
      )}
    >
      <div className={cn('p-2 rounded-full shrink-0', config.bgClass)}>
        <Icon className={cn('h-4 w-4', config.colorClass)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm font-medium truncate',
            !notification.is_read && 'font-semibold'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
           {formatAdminNotificationTime(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
