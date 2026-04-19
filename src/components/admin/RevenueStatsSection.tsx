import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, subMonths, subQuarters } from 'date-fns';
import { CalendarIcon, DollarSign, TrendingUp, Users, Activity } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAdminRevenueStats } from '@/hooks/use-admin';

type PresetKey = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'ytd' | 'all_time';

function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  switch (key) {
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'this_quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'last_quarter': {
      const prev = subQuarters(now, 1);
      return { from: startOfQuarter(prev), to: endOfQuarter(prev) };
    }
    case 'ytd':
      return { from: startOfYear(now), to: now };
    case 'all_time':
      return { from: new Date('2020-01-01'), to: now };
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all_time', label: 'All Time' },
];

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toLocaleString()}`;
  }
}

export function RevenueStatsSection() {
  const [range, setRange] = useState<DateRange>(() => getPresetRange('this_month'));
  const [activePreset, setActivePreset] = useState<PresetKey | null>('this_month');

  const startDate = range?.from ?? startOfMonth(new Date());
  const endDate = range?.to ?? endOfMonth(new Date());

  const { data, isLoading } = useAdminRevenueStats(startDate, endDate);

  const rangeLabel = useMemo(() => {
    if (!range?.from) return 'Pick a date range';
    if (!range.to) return format(range.from, 'PP');
    return `${format(range.from, 'PP')} – ${format(range.to, 'PP')}`;
  }, [range]);

  const applyPreset = (key: PresetKey) => {
    setActivePreset(key);
    setRange(getPresetRange(key));
  };

  const cards = [
    {
      title: 'MRR',
      value: data ? formatMoney(data.mrrCents, data.currency) : '—',
      icon: DollarSign,
      description: 'Monthly recurring revenue',
      color: 'text-green-600',
    },
    {
      title: 'ARR',
      value: data ? formatMoney(data.arrCents, data.currency) : '—',
      icon: TrendingUp,
      description: 'Annual run rate (MRR × 12)',
      color: 'text-primary',
    },
    {
      title: 'Paying Subscribers',
      value: data ? data.payingCount.toLocaleString() : '—',
      icon: Users,
      description: 'Active in selected range',
      color: 'text-blue-600',
    },
    {
      title: 'Net New',
      value: data ? `${data.netNew >= 0 ? '+' : ''}${data.netNew}` : '—',
      icon: Activity,
      description: data ? `${data.newInPeriod} new · ${data.churnedInPeriod} churned` : '—',
      color: data && data.netNew < 0 ? 'text-destructive' : 'text-amber-600',
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Metrics
          </CardTitle>
          <CardDescription>MRR, ARR & subscriber movement (USD, normalized)</CardDescription>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal min-w-[260px]')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex flex-col sm:flex-row">
              <div className="flex flex-row sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r overflow-x-auto">
                {PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={activePreset === p.key ? 'secondary' : 'ghost'}
                    className="justify-start whitespace-nowrap"
                    onClick={() => applyPreset(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setActivePreset(null);
                  setRange(r ?? { from: undefined, to: undefined });
                }}
                numberOfMonths={2}
                className={cn('p-3 pointer-events-auto')}
              />
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{c.value}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium mb-3">Tier Breakdown</div>
          {isLoading || !data ? (
            <Skeleton className="h-6 w-full" />
          ) : data.payingCount === 0 ? (
            <p className="text-sm text-muted-foreground">No active paying subscriptions in this range.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Professional</Badge>
                <span className="text-muted-foreground">
                  {data.breakdown.professional.count} ×{' '}
                  {formatMoney(data.breakdown.professional.monthlyPriceCents, data.currency)} ={' '}
                </span>
                <span className="font-semibold">
                  {formatMoney(data.breakdown.professional.mrrCents, data.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="default">Business</Badge>
                <span className="text-muted-foreground">
                  {data.breakdown.business.count} ×{' '}
                  {formatMoney(data.breakdown.business.monthlyPriceCents, data.currency)} ={' '}
                </span>
                <span className="font-semibold">
                  {formatMoney(data.breakdown.business.mrrCents, data.currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
