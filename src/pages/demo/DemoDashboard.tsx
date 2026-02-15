import { DemoLayout } from './DemoLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  FileEdit,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const stats = [
  {
    title: 'Total Revenue',
    value: 6195000,
    icon: DollarSign,
    change: '+12.5%',
    trend: 'up' as const,
  },
  {
    title: 'Outstanding',
    value: 2890000,
    icon: Clock,
    subtitle: '4 invoices',
    change: '-8.2%',
    trend: 'down' as const,
  },
  {
    title: 'Paid This Month',
    value: 3030000,
    icon: CheckCircle2,
    subtitle: '3 invoices',
    change: '+24.1%',
    trend: 'up' as const,
  },
  {
    title: 'Draft Invoices',
    value: 1,
    icon: FileEdit,
    isCurrency: false,
  },
];

const revenueData = [
  { month: 'Sep', revenue: 1850000 },
  { month: 'Oct', revenue: 2400000 },
  { month: 'Nov', revenue: 1950000 },
  { month: 'Dec', revenue: 3100000 },
  { month: 'Jan', revenue: 2750000 },
  { month: 'Feb', revenue: 3030000 },
];

const recentInvoices = [
  { number: 'INV-001', client: 'Afritech Solutions', amount: 1250000, status: 'paid', date: '2026-02-10' },
  { number: 'INV-002', client: 'Green Energy Nigeria', amount: 890000, status: 'pending', date: '2026-02-08' },
  { number: 'INV-003', client: 'Lagos Digital Hub', amount: 750000, status: 'overdue', date: '2026-01-25' },
  { number: 'INV-004', client: 'Zenith Traders Ltd', amount: 1500000, status: 'paid', date: '2026-02-05' },
  { number: 'INV-005', client: 'Kano Textiles Co.', amount: 475000, status: 'pending', date: '2026-02-12' },
];

const statusColors: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-muted text-muted-foreground',
  overdue: 'bg-destructive/10 text-destructive',
  draft: 'bg-muted text-muted-foreground',
};

export default function DemoDashboard() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back, Demo User</h1>
            <p className="text-muted-foreground text-sm">Here's your business overview</p>
          </div>
          <Badge variant="secondary">This Month</Badge>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {stat.isCurrency === false
                      ? stat.value
                      : formatCurrency(stat.value, 'NGN')}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {stat.change && (
                      <>
                        {stat.trend === 'up' ? (
                          <TrendingUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-destructive" />
                        )}
                        <span
                          className={`text-xs ${
                            stat.trend === 'up'
                              ? 'text-emerald-600'
                              : 'text-destructive'
                          }`}
                        >
                          {stat.change}
                        </span>
                      </>
                    )}
                    {stat.subtitle && (
                      <span className="text-xs text-muted-foreground ml-1">
                        {stat.subtitle}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Chart + Recent Invoices */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Revenue Chart */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value, 'NGN'), 'Revenue']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.number}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {inv.client}
                    </p>
                    <p className="text-xs text-muted-foreground">{inv.number}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(inv.amount, 'NGN')}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        statusColors[inv.status]
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DemoLayout>
  );
}
