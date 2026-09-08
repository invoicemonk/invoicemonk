import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import {
  ADMIN_NOTIFICATION_CATEGORIES,
  ADMIN_NOTIFICATION_TYPES,
  getNotificationCategory as getSharedNotificationCategory,
} from '@/lib/admin-notifications';
import type {
  AdminNotificationCategory,
  AdminNotificationType,
} from '@/lib/admin-notifications';

export type { AdminNotificationCategory, AdminNotificationType } from '@/lib/admin-notifications';

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

// The shared allowlist keeps the page, dropdown, and item renderer in sync.
const ADMIN_ONLY_TYPES = ADMIN_NOTIFICATION_TYPES;

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
      .channel(`admin-notifications-realtime-${crypto.randomUUID()}`)
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
  return getSharedNotificationCategory(type);
}
