import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface CoverageRow {
  id: string;
  tier: string;
  status: string;
  business_id: string | null;
  paid_through: string;
  paid_through_reason: string | null;
  paid_through_granted_by: string | null;
  paid_through_granted_at: string | null;
  businessName?: string | null;
  grantedByEmail?: string | null;
}

/**
 * Durable prepaid coverage (paid_through) granted by support.
 * Shows it explicitly so nobody has to infer credit from Stripe.
 */
export function PaidThroughCoverageCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-paid-through-coverage'],
    queryFn: async (): Promise<CoverageRow[]> => {
      const { data: rows, error } = await supabase
        .from('subscriptions')
        .select(
          'id, tier, status, business_id, paid_through, paid_through_reason, paid_through_granted_by, paid_through_granted_at',
        )
        .not('paid_through', 'is', null)
        .order('paid_through', { ascending: false })
        .limit(50);
      if (error) throw error;

      const list = (rows ?? []) as CoverageRow[];
      const businessIds = [...new Set(list.map((r) => r.business_id).filter(Boolean))] as string[];
      const granterIds = [...new Set(list.map((r) => r.paid_through_granted_by).filter(Boolean))] as string[];

      const [biz, granters] = await Promise.all([
        businessIds.length
          ? supabase.from('businesses').select('id, name').in('id', businessIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        granterIds.length
          ? supabase.from('profiles').select('id, email').in('id', granterIds)
          : Promise.resolve({ data: [] as { id: string; email: string }[] }),
      ]);

      const bizMap = new Map((biz.data ?? []).map((b: any) => [b.id, b.name]));
      const granterMap = new Map((granters.data ?? []).map((p: any) => [p.id, p.email]));

      return list.map((r) => ({
        ...r,
        businessName: r.business_id ? bizMap.get(r.business_id) ?? null : null,
        grantedByEmail: r.paid_through_granted_by ? granterMap.get(r.paid_through_granted_by) ?? null : null,
      }));
    },
    staleTime: 60_000,
  });

  const fmt = (v: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Prepaid coverage (paid through)
        </CardTitle>
        <CardDescription>
          Subscriptions with durable credit granted by support. These are never downgraded by
          reconciliation or webhooks before the coverage date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active prepaid coverage on record.</p>
        ) : (
          <div className="space-y-3">
            {data.map((row) => {
              const active = new Date(row.paid_through).getTime() > Date.now();
              return (
                <div key={row.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.businessName || row.id}</span>
                    <Badge variant="outline" className="capitalize">{row.tier}</Badge>
                    <Badge variant={active ? 'secondary' : 'outline'}>
                      {active ? 'Covered until' : 'Expired'} {fmt(row.paid_through)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reason: {row.paid_through_reason || '— (no reason recorded)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Granted by {row.grantedByEmail || row.paid_through_granted_by || 'unknown'} on{' '}
                    {fmt(row.paid_through_granted_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
