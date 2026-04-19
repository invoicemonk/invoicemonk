import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Store, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useVendors, useVendorAnalytics, type Vendor } from '@/hooks/use-vendors';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import {
  AccountingPeriodSelector,
  getAccountingDateRange,
  getPeriodLabel,
} from '@/components/accounting/AccountingPeriodSelector';
import { useAccountingPreferences, type AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { AddVendorDialog } from '@/components/vendors/AddVendorDialog';
import { VendorDetailSheet } from '@/components/vendors/VendorDetailSheet';
import { formatCurrency } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useVendorStats } from '@/hooks/use-vendors';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

type SortKey = 'name' | 'period_spend' | 'all_time' | 'count' | 'last_paid';

const getCategoryLabel = (value: string | null) =>
  value ? EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value : '—';

interface AggregateRow {
  vendor_id: string;
  total_all_time: number;
  count: number;
  last_paid: string | null;
  top_category: string | null;
}

/**
 * Aggregates expenses across all time per vendor for the active business + currency account.
 * Used for the page table (period spend comes from useVendorAnalytics).
 */
function useVendorTableAggregates(businessId?: string, currencyAccountId?: string) {
  return useQuery({
    queryKey: ['vendor-aggregates', businessId, currencyAccountId],
    queryFn: async (): Promise<Record<string, AggregateRow>> => {
      if (!businessId) return {};
      let q = supabase
        .from('expenses')
        .select('vendor_id, amount, expense_date, category')
        .eq('business_id', businessId)
        .not('vendor_id', 'is', null);
      if (currencyAccountId) q = q.eq('currency_account_id', currencyAccountId);
      const { data, error } = await q;
      if (error) throw error;
      const out: Record<string, AggregateRow> = {};
      const catMap: Record<string, Map<string, number>> = {};
      for (const r of data || []) {
        const id = r.vendor_id as string;
        if (!id) continue;
        const amt = Number(r.amount) || 0;
        if (!out[id]) {
          out[id] = { vendor_id: id, total_all_time: 0, count: 0, last_paid: null, top_category: null };
          catMap[id] = new Map();
        }
        out[id].total_all_time += amt;
        out[id].count += 1;
        if (!out[id].last_paid || r.expense_date > out[id].last_paid!) {
          out[id].last_paid = r.expense_date;
        }
        const c = catMap[id];
        c.set(r.category, (c.get(r.category) || 0) + amt);
      }
      for (const id of Object.keys(out)) {
        let topCat: string | null = null;
        let topAmt = 0;
        for (const [cat, amt] of catMap[id]) {
          if (amt > topAmt) {
            topAmt = amt;
            topCat = cat;
          }
        }
        out[id].top_category = topCat;
      }
      return out;
    },
    enabled: !!businessId,
  });
}

export default function Vendors() {
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const { data: preferences } = useAccountingPreferences();
  const [period, setPeriod] = useState<AccountingPeriod>(
    preferences?.defaultAccountingPeriod || 'monthly'
  );
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('period_spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Vendor | null>(null);

  const dateRange = getAccountingDateRange(period);

  const { data: vendors = [], isLoading: loadingVendors } = useVendors(currentBusiness?.id);
  const { data: analytics } = useVendorAnalytics(
    currentBusiness?.id,
    currentCurrencyAccount?.id,
    dateRange ?? undefined
  );
  const { data: aggregates } = useVendorTableAggregates(
    currentBusiness?.id,
    currentCurrencyAccount?.id
  );

  const periodMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of analytics || []) m.set(a.vendor_id, a.total);
    return m;
  }, [analytics]);

  const rows = useMemo(() => {
    const filtered = vendors.filter((v) =>
      v.name.toLowerCase().includes(search.toLowerCase())
    );
    const enriched = filtered.map((v) => {
      const agg = aggregates?.[v.id];
      return {
        vendor: v,
        period_spend: periodMap.get(v.id) || 0,
        total_all_time: agg?.total_all_time || 0,
        count: agg?.count || 0,
        last_paid: agg?.last_paid || null,
        top_category: agg?.top_category || null,
      };
    });
    enriched.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return a.vendor.name.localeCompare(b.vendor.name) * dir;
        case 'period_spend':
          return (a.period_spend - b.period_spend) * dir;
        case 'all_time':
          return (a.total_all_time - b.total_all_time) * dir;
        case 'count':
          return (a.count - b.count) * dir;
        case 'last_paid': {
          const av = a.last_paid || '';
          const bv = b.last_paid || '';
          return av.localeCompare(bv) * dir;
        }
      }
    });
    return enriched;
  }, [vendors, aggregates, periodMap, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const SortableTh = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => toggleSort(k)}
      >
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </TableHead>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Store className="h-7 w-7" />
            Vendors
          </h1>
          <p className="text-muted-foreground mt-1">
            All vendors you've paid in {getPeriodLabel(period)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AccountingPeriodSelector value={period} onChange={setPeriod} />
          <AddVendorDialog />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>All Vendors</CardTitle>
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {loadingVendors ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No vendors yet</p>
              <p className="text-sm mt-1">
                Add a vendor or record an expense — vendors are created automatically when you pay them.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTh k="name">Vendor</SortableTh>
                  <SortableTh k="period_spend" className="text-right">
                    {getPeriodLabel(period)}
                  </SortableTh>
                  <SortableTh k="all_time" className="text-right">All-time</SortableTh>
                  <SortableTh k="count" className="text-right">Expenses</SortableTh>
                  <SortableTh k="last_paid">Last paid</SortableTh>
                  <TableHead>Top category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ vendor, period_spend, total_all_time, count, last_paid, top_category }) => (
                  <TableRow
                    key={vendor.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(vendor)}
                  >
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(period_spend, activeCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(total_all_time, activeCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {last_paid ? format(new Date(last_paid), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {top_category ? (
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(top_category)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VendorDetailSheet
        vendor={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </motion.div>
  );
}
