import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  CreditCard,
  Download,
  FileText,
  Headphones,
  Mail,
  MessageCircle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export const ADMIN_NOTIFICATION_TYPES = [
  'ADMIN_USER_REGISTERED',
  'ADMIN_EMAIL_VERIFIED',
  'ADMIN_SUBSCRIPTION_UPGRADED',
  'ADMIN_SUBSCRIPTION_DOWNGRADED',
  'ADMIN_PAID_DOWNGRADE',
  'ADMIN_PAYMENT_FAILED',
  'ADMIN_FIRST_INVOICE_ISSUED',
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_TICKET_REPLY',
  'SUPPORT_TICKET_USER_REPLY',
  'ADMIN_EXPORT_FAILED',
  'ADMIN_VERIFICATION_FAILED',
  'ADMIN_VERIFICATION_SUBMITTED',
] as const;

export type AdminNotificationType = typeof ADMIN_NOTIFICATION_TYPES[number];

export const ADMIN_NOTIFICATION_CATEGORIES = {
  users: ['ADMIN_USER_REGISTERED', 'ADMIN_EMAIL_VERIFIED'],
  billing: [
    'ADMIN_SUBSCRIPTION_UPGRADED',
    'ADMIN_SUBSCRIPTION_DOWNGRADED',
    'ADMIN_PAID_DOWNGRADE',
    'ADMIN_PAYMENT_FAILED',
    'ADMIN_FIRST_INVOICE_ISSUED',
  ],
  support: ['SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_REPLY', 'SUPPORT_TICKET_USER_REPLY'],
  compliance: ['ADMIN_EXPORT_FAILED', 'ADMIN_VERIFICATION_FAILED', 'ADMIN_VERIFICATION_SUBMITTED'],
} as const satisfies Record<string, readonly AdminNotificationType[]>;

export type AdminNotificationCategory = keyof typeof ADMIN_NOTIFICATION_CATEGORIES;

export interface AdminNotificationVisualConfig {
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}

const notificationConfig: Record<AdminNotificationType, AdminNotificationVisualConfig> = {
  ADMIN_USER_REGISTERED: { icon: UserPlus, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  ADMIN_EMAIL_VERIFIED: { icon: Mail, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  ADMIN_SUBSCRIPTION_UPGRADED: { icon: TrendingUp, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  ADMIN_SUBSCRIPTION_DOWNGRADED: { icon: TrendingDown, colorClass: 'text-muted-foreground', bgClass: 'bg-muted' },
  ADMIN_PAID_DOWNGRADE: { icon: TrendingDown, colorClass: 'text-muted-foreground', bgClass: 'bg-muted' },
  ADMIN_PAYMENT_FAILED: { icon: AlertTriangle, colorClass: 'text-destructive', bgClass: 'bg-destructive/10' },
  ADMIN_FIRST_INVOICE_ISSUED: { icon: FileText, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  SUPPORT_TICKET_CREATED: { icon: MessageCircle, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  SUPPORT_TICKET_REPLY: { icon: Headphones, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  SUPPORT_TICKET_USER_REPLY: { icon: Headphones, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  ADMIN_EXPORT_FAILED: { icon: Download, colorClass: 'text-destructive', bgClass: 'bg-destructive/10' },
  ADMIN_VERIFICATION_FAILED: { icon: ShieldAlert, colorClass: 'text-destructive', bgClass: 'bg-destructive/10' },
  ADMIN_VERIFICATION_SUBMITTED: { icon: FileText, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
};

const defaultConfig: AdminNotificationVisualConfig = {
  icon: MessageCircle,
  colorClass: 'text-muted-foreground',
  bgClass: 'bg-muted',
};

export function getAdminNotificationConfig(type: string): AdminNotificationVisualConfig {
  return notificationConfig[type as AdminNotificationType] ?? defaultConfig;
}

export function getNotificationCategory(type: string): AdminNotificationCategory | null {
  for (const [category, types] of Object.entries(ADMIN_NOTIFICATION_CATEGORIES)) {
    if ((types as readonly string[]).includes(type)) {
      return category as AdminNotificationCategory;
    }
  }
  return null;
}

export function isNotificationInCategory(
  type: string,
  category: AdminNotificationCategory,
): boolean {
  return (ADMIN_NOTIFICATION_CATEGORIES[category] as readonly string[]).includes(type);
}

export function formatAdminNotificationTime(value: string | null | undefined): string {
  if (!value) return 'Date unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return formatDistanceToNow(date, { addSuffix: true });
}

// Kept as a named export for consumers that need the payment icon in admin surfaces.
export { CreditCard };