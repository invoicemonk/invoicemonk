import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';

export interface Vendor {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  tax_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorAnalyticsRow {
  vendor_id: string;
  name: string;
  total: number;
  count: number;
  percent: number;
}

export interface VendorStats {
  total_spend_all_time: number;
  total_spend_period: number;
  expense_count: number;
  last_paid: string | null;
  top_category: string | null;
}

/**
 * List vendors for a business.
 *
 * SECURITY: RLS policy "Business members can view vendors" enforces business membership.
 */
export function useVendors(businessId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vendors', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Vendor[];
    },
    enabled: !!user && !!businessId,
  });
}

/**
 * Single vendor by ID. RLS enforces business membership.
 */
export function useVendor(vendorId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();
      if (error) throw error;
      return data as unknown as Vendor;
    },
    enabled: !!user && !!vendorId,
  });
}

/**
 * Spend analytics per vendor for the given business + currency account, optionally filtered by date range.
 *
 * Returns rows sorted by total spend desc.
 */
export function useVendorAnalytics(
  businessId?: string,
  currencyAccountId?: string,
  dateRange?: { start: Date; end: Date }
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      'vendor-analytics',
      businessId,
      currencyAccountId,
      dateRange?.start?.toISOString(),
      dateRange?.end?.toISOString(),
    ],
    queryFn: async (): Promise<VendorAnalyticsRow[]> => {
      if (!businessId) return [];

      let q = supabase
        .from('expenses')
        .select('vendor_id, vendor, amount')
        .eq('business_id', businessId)
        .not('vendor_id', 'is', null);

      if (currencyAccountId) q = q.eq('currency_account_id', currencyAccountId);
      if (dateRange) {
        q = q
          .gte('expense_date', dateRange.start.toISOString().split('T')[0])
          .lte('expense_date', dateRange.end.toISOString().split('T')[0]);
      }

      const { data: expenses, error } = await q;
      if (error) throw error;

      // Aggregate by vendor_id
      const byVendor = new Map<string, { total: number; count: number; name: string }>();
      let grandTotal = 0;
      for (const row of expenses || []) {
        const id = row.vendor_id as string | null;
        if (!id) continue;
        const amt = Number(row.amount) || 0;
        grandTotal += amt;
        const cur = byVendor.get(id) || { total: 0, count: 0, name: row.vendor || '' };
        cur.total += amt;
        cur.count += 1;
        if (row.vendor) cur.name = row.vendor;
        byVendor.set(id, cur);
      }

      // Fetch vendor names (canonical) to override snapshot
      const ids = [...byVendor.keys()];
      if (ids.length > 0) {
        const { data: vendorRows } = await supabase
          .from('vendors')
          .select('id, name')
          .in('id', ids);
        for (const v of vendorRows || []) {
          const cur = byVendor.get(v.id);
          if (cur) cur.name = v.name;
        }
      }

      return [...byVendor.entries()]
        .map(([vendor_id, v]) => ({
          vendor_id,
          name: v.name,
          total: v.total,
          count: v.count,
          percent: grandTotal > 0 ? Math.round((v.total / grandTotal) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: !!user && !!businessId,
  });
}

/**
 * Per-vendor stats: all-time + current-period spend, expense count, last paid date, top category.
 */
export function useVendorStats(
  vendorId?: string,
  currencyAccountId?: string,
  periodRange?: { start: Date; end: Date }
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      'vendor-stats',
      vendorId,
      currencyAccountId,
      periodRange?.start?.toISOString(),
      periodRange?.end?.toISOString(),
    ],
    queryFn: async (): Promise<VendorStats> => {
      const empty: VendorStats = {
        total_spend_all_time: 0,
        total_spend_period: 0,
        expense_count: 0,
        last_paid: null,
        top_category: null,
      };
      if (!vendorId) return empty;

      let q = supabase
        .from('expenses')
        .select('amount, expense_date, category')
        .eq('vendor_id', vendorId);
      if (currencyAccountId) q = q.eq('currency_account_id', currencyAccountId);

      const { data, error } = await q;
      if (error) throw error;

      const rows = data || [];
      const periodStart = periodRange?.start.toISOString().split('T')[0];
      const periodEnd = periodRange?.end.toISOString().split('T')[0];

      let total = 0;
      let totalPeriod = 0;
      let lastPaid: string | null = null;
      const byCat = new Map<string, number>();

      for (const r of rows) {
        const amt = Number(r.amount) || 0;
        total += amt;
        if (periodStart && periodEnd && r.expense_date >= periodStart && r.expense_date <= periodEnd) {
          totalPeriod += amt;
        }
        if (!lastPaid || r.expense_date > lastPaid) lastPaid = r.expense_date;
        byCat.set(r.category, (byCat.get(r.category) || 0) + amt);
      }

      let topCategory: string | null = null;
      let topAmt = 0;
      for (const [cat, amt] of byCat) {
        if (amt > topAmt) {
          topAmt = amt;
          topCategory = cat;
        }
      }

      return {
        total_spend_all_time: total,
        total_spend_period: periodRange ? totalPeriod : total,
        expense_count: rows.length,
        last_paid: lastPaid,
        top_category: topCategory,
      };
    },
    enabled: !!user && !!vendorId,
  });
}

/**
 * Expenses for a single vendor (paginated by ordered date).
 */
export function useVendorExpenses(vendorId?: string, limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vendor-expenses', vendorId, limit],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, currency, expense_date, category, description, receipt_url')
        .eq('vendor_id', vendorId)
        .order('expense_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!vendorId,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      business_id: string;
      name: string;
      email?: string;
      phone?: string;
      tax_id?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          business_id: input.business_id,
          name: input.name.trim(),
          email: input.email || null,
          phone: input.phone || null,
          tax_id: input.tax_id || null,
          notes: input.notes || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Vendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: 'Vendor created' });
    },
    onError: (error: Error) => {
      captureError(error, { hook: 'useCreateVendor' });
      toast({
        title: 'Could not create vendor',
        description: error.message.includes('duplicate')
          ? 'A vendor with this name already exists for this business.'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      updates: Partial<Pick<Vendor, 'name' | 'email' | 'phone' | 'tax_id' | 'notes'>>;
    }) => {
      const { data, error } = await supabase
        .from('vendors')
        .update(input.updates as never)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Vendor;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor', data.id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-analytics'] });
      toast({ title: 'Vendor updated' });
    },
    onError: (error: Error) => {
      captureError(error, { hook: 'useUpdateVendor' });
      toast({ title: 'Could not update vendor', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // expenses.vendor_id will be set NULL by FK cascade rule
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Vendor deleted' });
    },
    onError: (error: Error) => {
      captureError(error, { hook: 'useDeleteVendor' });
      toast({ title: 'Could not delete vendor', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Merge sourceVendorId INTO targetVendorId.
 * Re-points all expenses, then deletes the source row.
 */
export function useMergeVendors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { source_id: string; target_id: string; target_name: string }) => {
      if (input.source_id === input.target_id) {
        throw new Error('Cannot merge a vendor into itself.');
      }
      // Re-point expenses (also update legacy vendor text snapshot)
      const { error: updErr } = await supabase
        .from('expenses')
        .update({ vendor_id: input.target_id, vendor: input.target_name } as never)
        .eq('vendor_id', input.source_id);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase.from('vendors').delete().eq('id', input.source_id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Vendors merged' });
    },
    onError: (error: Error) => {
      captureError(error, { hook: 'useMergeVendors' });
      toast({ title: 'Could not merge vendors', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Find existing vendor by normalised name, or create + return one.
 * Used by VendorPicker for inline-create flow.
 */
export async function findOrCreateVendor(
  businessId: string,
  rawName: string,
  userId: string
): Promise<Vendor> {
  const name = rawName.trim();
  if (!name) throw new Error('Vendor name is required');
  const norm = name.toLowerCase();

  // Try to find existing
  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .eq('business_id', businessId);

  const match = (existing || []).find((v) => v.name.trim().toLowerCase() === norm);
  if (match) return match as unknown as Vendor;

  const { data, error } = await supabase
    .from('vendors')
    .insert({ business_id: businessId, name, created_by: userId })
    .select()
    .single();
  if (error) {
    // Race condition fallback: try read again
    const { data: retry } = await supabase
      .from('vendors')
      .select('*')
      .eq('business_id', businessId);
    const m = (retry || []).find((v) => v.name.trim().toLowerCase() === norm);
    if (m) return m as unknown as Vendor;
    throw error;
  }
  return data as unknown as Vendor;
}
