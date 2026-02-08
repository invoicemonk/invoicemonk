import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { 
  UserPlus, 
  Mail, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  FileText,
  MessageCircle,
  Headphones,
  ShieldAlert,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  AdminNotification, 
  AdminNotificationType,
  getNotificationCategory,
  useAdminMarkAsRead 
} from '@/hooks/use-admin-notifications';

interface AdminNotificationItemProps {
  notification: AdminNotification;
  onClose?: () => void;
}

// Icon and color mapping for admin notification types
const notificationConfig: Record<AdminNotificationType, { 
  icon: typeof UserPlus; 
  colorClass: string;
  bgClass: string;
}> = {
  'ADMIN_USER_REGISTERED': { 
    icon: UserPlus, 
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30'
  },
  'ADMIN_EMAIL_VERIFIED': { 
    icon: Mail, 
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30'
  },
  'ADMIN_SUBSCRIPTION_UPGRADED': { 
    icon: TrendingUp, 
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30'
  },
  'ADMIN_SUBSCRIPTION_DOWNGRADED': { 
    icon: TrendingDown, 
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30'
  },
  'ADMIN_PAYMENT_FAILED': { 
    icon: AlertTriangle, 
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10'
  },
  'ADMIN_FIRST_INVOICE_ISSUED': { 
    icon: FileText, 
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10'
  },
  'SUPPORT_TICKET_CREATED': { 
    icon: MessageCircle, 
    colorClass: 'text-yellow-600 dark:text-yellow-400',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  'SUPPORT_TICKET_USER_REPLY': { 
    icon: Headphones, 
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30'
  },
  'ADMIN_EXPORT_FAILED': { 
    icon: Download, 
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30'
  },
  'ADMIN_VERIFICATION_FAILED': { 
    icon: ShieldAlert, 
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30'
  },
};

// Default fallback config
const defaultConfig = {
  icon: MessageCircle,
  colorClass: 'text-muted-foreground',
  bgClass: 'bg-muted'
};

export function AdminNotificationItem({ notification, onClose }: AdminNotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useAdminMarkAsRead();

  const config = notificationConfig[notification.type] || defaultConfig;
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
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
