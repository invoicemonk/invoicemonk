import { FileText, CreditCard, AlertCircle, Mail, UserPlus, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useMarkAsRead, Notification, NotificationType } from '@/hooks/use-notifications';

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
}

const notificationIcons: Record<NotificationType, React.ElementType> = {
  INVOICE_ISSUED: FileText,
  PAYMENT_RECEIVED: CreditCard,
  INVOICE_OVERDUE: AlertCircle,
  INVOICE_SENT: Mail,
  INVOICE_VOIDED: XCircle,
  CLIENT_ADDED: UserPlus,
};

const notificationColors: Record<NotificationType, string> = {
  INVOICE_ISSUED: 'text-blue-500 bg-blue-500/10',
  PAYMENT_RECEIVED: 'text-green-500 bg-green-500/10',
  INVOICE_OVERDUE: 'text-destructive bg-destructive/10',
  INVOICE_SENT: 'text-purple-500 bg-purple-500/10',
  INVOICE_VOIDED: 'text-orange-500 bg-orange-500/10',
  CLIENT_ADDED: 'text-cyan-500 bg-cyan-500/10',
};

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();

  const Icon = notificationIcons[notification.type as NotificationType] || FileText;
  const colorClass = notificationColors[notification.type as NotificationType] || 'text-muted-foreground bg-muted';

  const handleClick = () => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }

    // Navigate to the related entity
    if (notification.entity_type && notification.entity_id) {
      switch (notification.entity_type) {
        case 'invoice':
          navigate(`/invoices/${notification.entity_id}`);
          break;
        case 'payment':
          // Navigate to the invoice for the payment
          navigate(`/invoices/${notification.entity_id}`);
          break;
        case 'client':
          navigate(`/clients/${notification.entity_id}`);
          break;
        default:
          break;
      }
    }

    onClose?.();
  };

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 rounded-lg',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      <div className={cn('p-2 rounded-full shrink-0', colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm font-medium truncate',
            !notification.is_read && 'text-foreground',
            notification.is_read && 'text-muted-foreground'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {timeAgo}
        </p>
      </div>
    </button>
  );
}
