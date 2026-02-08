import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface AdminNotification {
  id: string;
  user_id: string;
  business_id: null; // Admin notifications are always null (platform-scoped)
  type: AdminNotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// Admin-only notification types (Phase-1)
// These are strictly admin-scoped and separate from user notification types
export type AdminNotificationType =
  | 'ADMIN_USER_REGISTERED'
  | 'ADMIN_EMAIL_VERIFIED'
  | 'ADMIN_SUBSCRIPTION_UPGRADED'
  | 'ADMIN_SUBSCRIPTION_DOWNGRADED'
  | 'ADMIN_PAYMENT_FAILED'
  | 'ADMIN_FIRST_INVOICE_ISSUED'
  | 'SUPPORT_TICKET_CREATED'
  | 'SUPPORT_TICKET_USER_REPLY'
  | 'ADMIN_EXPORT_FAILED'
  | 'ADMIN_VERIFICATION_FAILED';

// Whitelist of admin-only notification types
// This prevents admins from seeing business-scoped user notifications
const ADMIN_ONLY_TYPES: AdminNotificationType[] = [
  'ADMIN_USER_REGISTERED',
  'ADMIN_EMAIL_VERIFIED',
  'ADMIN_SUBSCRIPTION_UPGRADED',
  'ADMIN_SUBSCRIPTION_DOWNGRADED',
  'ADMIN_PAYMENT_FAILED',
  'ADMIN_FIRST_INVOICE_ISSUED',
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_TICKET_USER_REPLY',
  'ADMIN_EXPORT_FAILED',
  'ADMIN_VERIFICATION_FAILED',
];

// Category mapping for filtering
export const ADMIN_NOTIFICATION_CATEGORIES = {
  users: ['ADMIN_USER_REGISTERED', 'ADMIN_EMAIL_VERIFIED'],
  billing: ['ADMIN_SUBSCRIPTION_UPGRADED', 'ADMIN_SUBSCRIPTION_DOWNGRADED', 'ADMIN_PAYMENT_FAILED', 'ADMIN_FIRST_INVOICE_ISSUED'],
  support: ['SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_USER_REPLY'],
  compliance: ['ADMIN_EXPORT_FAILED', 'ADMIN_VERIFICATION_FAILED'],
} as const;

export type AdminNotificationCategory = keyof typeof ADMIN_NOTIFICATION_CATEGORIES;

export function useAdminNotifications(limit = 50, category?: AdminNotificationCategory) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-notifications', user?.id, limit, category],
    queryFn: async () => {
      if (!user?.id) return [];

      // Determine which types to fetch based on category
      const typesToFetch = category 
        ? ADMIN_NOTIFICATION_CATEGORIES[category]
        : ADMIN_ONLY_TYPES;

      // Critical scoping rules:
      // 1. business_id IS NULL (admin-scoped only)
      // 2. type IN (ADMIN_ONLY_TYPES) - prevents seeing user notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('business_id', null)
        .in('type', typesToFetch)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as AdminNotification[];
    },
    enabled: !!user?.id,
  });

  // Set up realtime subscription for instant updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('admin-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Only invalidate if it's an admin notification type
          const newType = payload.new?.type;
          if (ADMIN_ONLY_TYPES.includes(newType as AdminNotificationType)) {
            queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
            queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread-count'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedType = payload.new?.type;
          if (ADMIN_ONLY_TYPES.includes(updatedType as AdminNotificationType)) {
            queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
            queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread-count'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useAdminUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-notifications-unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('business_id', null)
        .in('type', ADMIN_ONLY_TYPES)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });
}

export function useAdminMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread-count'] });
    },
  });
}

export function useAdminMarkAllAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .is('business_id', null)
        .in('type', ADMIN_ONLY_TYPES)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread-count'] });
    },
  });
}

// Helper to get category from notification type
export function getNotificationCategory(type: string): AdminNotificationCategory | null {
  for (const [category, types] of Object.entries(ADMIN_NOTIFICATION_CATEGORIES)) {
    if (types.includes(type as never)) {
      return category as AdminNotificationCategory;
    }
  }
  return null;
}
