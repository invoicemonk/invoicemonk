import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerContext } from '@/contexts/PartnerContext';

export function usePartnerLinks() {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-links', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('referral_links')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();
  const { partner } = usePartnerContext();

  return useMutation({
    mutationFn: async ({ code, landingPage }: { code: string; landingPage?: string }) => {
      if (!partner?.id) throw new Error('No partner profile');
      const { data, error } = await supabase
        .from('referral_links')
        .insert({
          partner_id: partner.id,
          code,
          landing_page: landingPage || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-links'] });
    },
  });
}

export function useUpdateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active, landing_page }: { id: string; is_active?: boolean; landing_page?: string | null }) => {
      const updates: Record<string, unknown> = {};
      if (is_active !== undefined) updates.is_active = is_active;
      if (landing_page !== undefined) updates.landing_page = landing_page;

      const { data, error } = await supabase
        .from('referral_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-links'] });
    },
  });
}

export function usePartnerReferrals() {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-referrals', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          id,
          customer_ref,
          attributed_at,
          is_self_referral,
          commission_business_id,
          created_at
        `)
        .eq('partner_id', partner.id)
        .eq('is_self_referral', false)
        .order('attributed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });
}

/**
 * Enriched referrals with subscription tier/status and lifetime commission.
 * Joins referrals → subscriptions (via commission_business_id) and commissions.
 */
export function usePartnerReferralsEnriched() {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-referrals-enriched', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];

      // Get referrals
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select('id, customer_ref, attributed_at, is_self_referral, commission_business_id, created_at')
        .eq('partner_id', partner.id)
        .eq('is_self_referral', false)
        .order('attributed_at', { ascending: false });
      if (error) throw error;
      if (!referrals || referrals.length === 0) return [];

      // Get commissions for these referrals
      const referralIds = referrals.map((r) => r.id);
      const { data: commissions } = await supabase
        .from('commissions')
        .select('referral_id, commission_amount, currency, status')
        .in('referral_id', referralIds);

      // Get subscriptions for commission businesses
      const businessIds = referrals
        .map((r) => r.commission_business_id)
        .filter((id): id is string => !!id);

      let subscriptionMap: Record<string, { tier: string; status: string }> = {};
      if (businessIds.length > 0) {
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('business_id, tier, status')
          .in('business_id', businessIds);
        for (const sub of subs || []) {
          if (sub.business_id) {
            subscriptionMap[sub.business_id] = { tier: sub.tier, status: sub.status };
          }
        }
      }

      // Aggregate commissions per referral
      const commissionMap: Record<string, { total: number; currency: string }> = {};
      for (const c of commissions || []) {
        if (!commissionMap[c.referral_id]) {
          commissionMap[c.referral_id] = { total: 0, currency: c.currency };
        }
        commissionMap[c.referral_id].total += Number(c.commission_amount);
      }

      return referrals.map((r) => {
        const sub = r.commission_business_id ? subscriptionMap[r.commission_business_id] : null;
        const comm = commissionMap[r.id];
        return {
          ...r,
          subscription_tier: sub?.tier || null,
          subscription_status: sub?.status || null,
          lifetime_commission: comm?.total || 0,
          commission_currency: comm?.currency || null,
        };
      });
    },
    enabled: !!partner?.id,
  });
}

export function usePartnerStats() {
  const { partner } = usePartnerContext();

  return useQuery({
    queryKey: ['partner-stats', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return { clicks: 0, signups: 0, activeCustomers: 0 };

      // Get link IDs
      const { data: links } = await supabase
        .from('referral_links')
        .select('id')
        .eq('partner_id', partner.id);

      const linkIds = links?.map((l) => l.id) || [];

      // Total clicks
      let clicks = 0;
      if (linkIds.length > 0) {
        const { count } = await supabase
          .from('referral_clicks')
          .select('*', { count: 'exact', head: true })
          .in('link_id', linkIds);
        clicks = count || 0;
      }

      // Signups
      const { count: signups } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partner.id)
        .eq('is_self_referral', false);

      // Active customers (have commission_business_id set)
      const { count: activeCustomers } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partner.id)
        .eq('is_self_referral', false)
        .not('commission_business_id', 'is', null);

      return {
        clicks,
        signups: signups || 0,
        activeCustomers: activeCustomers || 0,
      };
    },
    enabled: !!partner?.id,
  });
}
