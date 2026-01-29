import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { useCallback, useEffect, useRef } from 'react';

type AuditEventType = Database['public']['Enums']['audit_event_type'];
type SubscriptionStatus = Database['public']['Enums']['subscription_status'];
type SubscriptionTier = Database['public']['Enums']['subscription_tier'];
type AppRole = Database['public']['Enums']['app_role'];

// Helper to log admin data access (for audit trail)
async function logAdminDataAccess(entityType: string, scope: string, recordCount: number) {
  try {
    await supabase.rpc('log_audit_event', {
      _event_type: 'SETTINGS_UPDATED' as AuditEventType, // Using existing event type for now
      _entity_type: 'admin_view',
      _metadata: {
        admin_action: true,
        action_type: 'data_view',
        entity_type: entityType,
        scope,
        record_count: recordCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to log admin data access:', error);
  }
}

// Hook to log admin view on first data load
function useAdminViewLogger(entityType: string, data: unknown[] | null | undefined, search?: string) {
  const hasLogged = useRef(false);
  
  useEffect(() => {
    if (data && data.length > 0 && !hasLogged.current) {
      hasLogged.current = true;
      logAdminDataAccess(entityType, search || 'all', data.length);
    }
  }, [data, entityType, search]);
}

// Fetch all users with profiles
export function useAdminUsers(search?: string) {
  const query = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      // Fetch profiles
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (search) {
        profilesQuery = profilesQuery.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;
      
      if (!profiles || profiles.length === 0) return [];

      // Fetch roles for all users
      const userIds = profiles.map(p => p.id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Merge roles with profiles
      const rolesMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      return profiles.map(profile => ({
        ...profile,
        user_roles: rolesMap.get(profile.id)?.map(role => ({ role })) || []
      }));
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // 1 minute
  });

  // Log admin data access
  useAdminViewLogger('users', query.data, search);

  return query;
}

// Fetch all businesses (read-only for admin - no mutation capabilities)
export function useAdminBusinesses(search?: string) {
  const query = useQuery({
    queryKey: ['admin-businesses', search],
    queryFn: async () => {
      let q = supabase
        .from('businesses')
        .select(`
          *,
          business_members(count),
          subscriptions(tier, status)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (search) {
        q = q.or(`name.ilike.%${search}%,legal_name.ilike.%${search}%,tax_id.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // 1 minute
  });

  useAdminViewLogger('businesses', query.data, search);
  return query;
}

// Fetch all invoices (read-only - admin cannot modify financial records)
export function useAdminInvoices(search?: string) {
  const query = useQuery({
    queryKey: ['admin-invoices', search],
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(name, email),
          business:businesses(name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (search) {
        q = q.or(`invoice_number.ilike.%${search}%,verification_id::text.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // 30 seconds
  });

  useAdminViewLogger('invoices', query.data, search);
  return query;
}

// Fetch system-wide audit logs
export function useAdminAuditLogs(search?: string, eventType?: AuditEventType | 'all') {
  return useQuery({
    queryKey: ['admin-audit-logs', search, eventType],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp_utc', { ascending: false })
        .limit(500);

      if (eventType && eventType !== 'all') {
        query = query.eq('event_type', eventType as AuditEventType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // 30 seconds
  });
}

// Fetch export manifests (admin can view all)
export function useAdminExportManifests() {
  return useQuery({
    queryKey: ['admin-export-manifests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_manifests')
        .select('*')
        .order('timestamp_utc', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 120000, // 2 minutes
  });
}

// Fetch system stats
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Fetch various counts
      const [
        { count: userCount },
        { count: businessCount },
        { count: invoiceCount },
        { data: subscriptions },
        { data: recentLogs },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('businesses').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('tier, status'),
        supabase.from('audit_logs').select('event_type').order('timestamp_utc', { ascending: false }).limit(100),
      ]);

      // Calculate subscription distribution
      const subscriptionStats = {
        starter: 0,
        professional: 0,
        business: 0,
        active: 0,
        cancelled: 0,
      };

      subscriptions?.forEach((sub) => {
        if (sub.tier) subscriptionStats[sub.tier as keyof typeof subscriptionStats]++;
        if (sub.status === 'active') subscriptionStats.active++;
        if (sub.status === 'cancelled') subscriptionStats.cancelled++;
      });

      // Calculate event frequency
      const eventCounts: Record<string, number> = {};
      recentLogs?.forEach((log) => {
        eventCounts[log.event_type] = (eventCounts[log.event_type] || 0) + 1;
      });

      return {
        userCount: userCount || 0,
        businessCount: businessCount || 0,
        invoiceCount: invoiceCount || 0,
        subscriptionStats,
        recentEventCounts: eventCounts,
      };
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // 1 minute
  });
}

// Update user role (admin action - non-financial)
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      role, 
      reason 
    }: { 
      userId: string; 
      role: AppRole; 
      reason: string 
    }) => {
      if (!reason || reason.trim().length < 10) {
        throw new Error('A detailed reason (minimum 10 characters) is required for role changes');
      }

      // First, log the admin action with mandatory reason
      await supabase.rpc('log_audit_event', {
        _event_type: 'ROLE_CHANGED' as AuditEventType,
        _entity_type: 'user',
        _entity_id: userId,
        _metadata: { 
          new_role: role, 
          reason,
          admin_action: true,
          action_type: 'role_change'
        },
      });

      // Update the role
      const { data, error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: role as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User role updated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update user role');
      console.error('Update role error:', error);
    },
  });
}

// Update subscription (admin action with mandatory reason - non-financial override)
export function useAdminUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      subscriptionId, 
      updates, 
      reason 
    }: { 
      subscriptionId: string; 
      updates: { tier?: SubscriptionTier; status?: SubscriptionStatus }; 
      reason: string 
    }) => {
      if (!reason || reason.trim().length < 10) {
        throw new Error('A detailed reason (minimum 10 characters) is required for subscription changes');
      }

      // Log the admin action with mandatory reason
      await supabase.rpc('log_audit_event', {
        _event_type: 'SUBSCRIPTION_CHANGED' as AuditEventType,
        _entity_type: 'subscription',
        _entity_id: subscriptionId,
        _metadata: { 
          updates, 
          reason, 
          admin_override: true,
          action_type: 'subscription_override',
          requires_audit_review: true
        },
      });

      // Update subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast.success('Subscription updated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update subscription');
      console.error('Update subscription error:', error);
    },
  });
}

// Close user account (admin action with mandatory reason)
export function useAdminCloseAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      reason 
    }: { 
      userId: string; 
      reason: string 
    }) => {
      if (!reason || reason.trim().length < 20) {
        throw new Error('A detailed reason (minimum 20 characters) is required for account closure');
      }

      // Call the close_account function
      const { error } = await supabase.rpc('close_account', {
        _user_id: userId,
        _reason: reason
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Account closed successfully. Financial records preserved per retention policy.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to close account');
      console.error('Close account error:', error);
    },
  });
}

// NOTE: The following hooks have been intentionally REMOVED for compliance:
// - useAdminUpdateInvoice - Platform admins cannot modify invoices (DB-enforced)
// - useAdminDeleteInvoice - No one can delete issued invoices (DB-enforced)
// - useAdminCreatePayment - Platform admins cannot create payments (DB-enforced)
// - useAdminUpdatePayment - No one can modify payments (DB-enforced)
// - useAdminDeletePayment - No one can delete payments (DB-enforced)
// - useAdminCreateCreditNote - Platform admins cannot create credit notes (DB-enforced)
//
// All financial record mutations are restricted at the database level via RLS policies.
// This ensures compliance with government-grade audit requirements.
