import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { captureError } from '@/lib/sentry';
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

      // Fetch business memberships for all users
      const { data: memberships } = await supabase
        .from('business_members')
        .select('user_id, role, business:businesses!inner(id, name, jurisdiction)')
        .in('user_id', userIds)
        .not('accepted_at', 'is', null);

      const businessMap = new Map<string, any[]>();
      memberships?.forEach((m: any) => {
        const existing = businessMap.get(m.user_id) || [];
        existing.push({ role: m.role, business: m.business });
        businessMap.set(m.user_id, existing);
      });

      return profiles.map(profile => ({
        ...profile,
        user_roles: rolesMap.get(profile.id)?.map(role => ({ role })) || [],
        business_memberships: businessMap.get(profile.id) || [],
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

      // Fetch owner info for each business
      const businessIds = (data || []).map(b => b.id);
      const { data: ownerMembers } = await supabase
        .from('business_members')
        .select('business_id, user_id, role')
        .in('business_id', businessIds)
        .eq('role', 'owner');

      const ownerUserIds = [...new Set((ownerMembers || []).map(m => m.user_id))];
      let ownerProfiles: any[] = [];
      if (ownerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', ownerUserIds);
        ownerProfiles = profiles || [];
      }

      const ownerMap = new Map<string, any>();
      ownerMembers?.forEach(m => {
        const profile = ownerProfiles.find(p => p.id === m.user_id);
        if (profile) ownerMap.set(m.business_id, profile);
      });

      return (data || []).map(business => ({
        ...business,
        owner: ownerMap.get(business.id) || null,
      }));
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

// Revenue stats (MRR/ARR) for an admin-selected date range
export interface AdminRevenueStats {
  mrrCents: number;
  arrCents: number;
  payingCount: number;
  newInPeriod: number;
  churnedInPeriod: number;
  netNew: number;
  breakdown: {
    professional: { count: number; monthlyPriceCents: number; mrrCents: number };
    business: { count: number; monthlyPriceCents: number; mrrCents: number };
  };
  priceBuckets: Array<{
    tier: string;
    count: number;
    sourceMonthlyMinor: number;
    sourceCurrency: string;
    mrrUsdCents: number;
  }>;
  currency: string;
}

export function useAdminRevenueStats(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['admin-revenue-stats', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<AdminRevenueStats> => {
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      // Call edge function that resolves each subscription's actual billed amount via Stripe
      // (with pricing_regions fallback). This avoids the legacy-vs-current price hardcoding bug.
      const { data, error } = await supabase.functions.invoke('admin-revenue-stats', {
        body: { startIso, endIso },
      });
      if (error) throw error;

      const proCount = data?.breakdown?.professional?.count ?? 0;
      const bizCount = data?.breakdown?.business?.count ?? 0;
      const proMrr = data?.breakdown?.professional?.mrrCents ?? 0;
      const bizMrr = data?.breakdown?.business?.mrrCents ?? 0;

      return {
        mrrCents: data?.mrrCents ?? 0,
        arrCents: data?.arrCents ?? 0,
        payingCount: data?.payingCount ?? 0,
        newInPeriod: data?.newInPeriod ?? 0,
        churnedInPeriod: data?.churnedInPeriod ?? 0,
        netNew: data?.netNew ?? 0,
        breakdown: {
          professional: {
            count: proCount,
            monthlyPriceCents: proCount > 0 ? Math.round(proMrr / proCount) : 0,
            mrrCents: proMrr,
          },
          business: {
            count: bizCount,
            monthlyPriceCents: bizCount > 0 ? Math.round(bizMrr / bizCount) : 0,
            mrrCents: bizMrr,
          },
        },
        priceBuckets: data?.priceBuckets ?? [],
        currency: data?.currency ?? 'USD',
      };
    },
    staleTime: 60_000,
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
      captureError(error, { hook: 'useUpdateUserRole' });
      toast.error(error instanceof Error ? error.message : 'Failed to update user role');
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
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Subscription updated successfully');
    },
    onError: (error) => {
      captureError(error, { hook: 'useAdminUpdateSubscription' });
      toast.error(error instanceof Error ? error.message : 'Failed to update subscription');
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
      captureError(error, { hook: 'useAdminCloseAccount' });
      toast.error(error instanceof Error ? error.message : 'Failed to close account');
    },
  });
}

// Ban user (admin action)
export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      if (!reason || reason.trim().length < 10) {
        throw new Error('A detailed reason (minimum 10 characters) is required for banning a user');
      }
      const { error } = await supabase.rpc('ban_user' as any, {
        _user_id: userId,
        _reason: reason,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User has been suspended');
    },
    onError: (error) => {
      captureError(error, { hook: 'useBanUser' });
      toast.error(error instanceof Error ? error.message : 'Failed to suspend user');
    },
  });
}

// Unban user (admin action)
export function useUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { error } = await supabase.rpc('unban_user' as any, {
        _user_id: userId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User has been reactivated');
    },
    onError: (error) => {
      captureError(error, { hook: 'useUnbanUser' });
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate user');
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
