import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  Shield,
  Loader2,
  RefreshCw,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useDashboardStats, useRecentInvoices, useDueDateStats, useRefreshDashboard, useRevenueTrend, type DateRange } from '@/hooks/use-dashboard-stats';
import { useRealtimeInvoices } from '@/hooks/use-realtime-invoices';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    issued: 'outline',
    sent: 'outline',
    viewed: 'outline',
    paid: 'default',
    voided: 'destructive',
    credited: 'destructive',
  };

  return (
    <Badge variant={variants[status] || 'secondary'} className="capitalize">
      {status}
    </Badge>
  );
}

type DateRangePreset = 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all_time' | 'custom';

function getDateRangeFromPreset(preset: DateRangePreset): DateRange | undefined {
  const now = new Date();
  
  switch (preset) {
    case 'this_week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    case 'all_time':
    case 'custom':
    default:
      return undefined;
  }
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const isEmailVerified = user?.email_confirmed_at;
  
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all_time');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  
  const dateRange = useMemo((): DateRange | undefined => {
    if (dateRangePreset === 'custom' && customDateFrom && customDateTo) {
      const start = new Date(customDateFrom);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customDateTo);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return getDateRangeFromPreset(dateRangePreset);
  }, [dateRangePreset, customDateFrom, customDateTo]);
  
  useRealtimeInvoices(currentBusiness?.id, user?.id);
  const { refresh, isRefreshing } = useRefreshDashboard();
  
  // All hooks now use currency account scoping
  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    currentBusiness?.id, 
    currentCurrencyAccount?.id,
    activeCurrency,
    dateRange
  );
  const { data: recentInvoices, isLoading: invoicesLoading } = useRecentInvoices(
    currentBusiness?.id,
    currentCurrencyAccount?.id
  );
  const { data: dueDateStats, isLoading: dueDateLoading } = useDueDateStats(
    currentBusiness?.id,
    currentCurrencyAccount?.id,
    activeCurrency
  );
  const { data: revenueTrend, isLoading: trendLoading } = useRevenueTrend(
    currentBusiness?.id, 
    currentCurrencyAccount?.id,
    activeCurrency,
    12
  );
  
  const businessComplianceStatus = currentBusiness?.compliance_status || 'incomplete';

  const statsCards = [
    {
      title: 'Total Revenue',
      value: statsLoading ? null : formatCurrency(stats?.totalRevenue || 0, stats?.currency),
      change: dateRangePreset === 'all_time' ? 'All time revenue' : 'In selected period',
      icon: DollarSign,
    },
    {
      title: 'Outstanding',
      value: statsLoading ? null : formatCurrency(stats?.outstanding || 0, stats?.currency),
      change: `${stats?.outstandingCount || 0} invoice${stats?.outstandingCount !== 1 ? 's' : ''}`,
      icon: Clock,
    },
    {
      title: 'Paid This Month',
      value: statsLoading ? null : formatCurrency(stats?.paidThisMonth || 0, stats?.currency),
      change: `${stats?.paidThisMonthCount || 0} invoice${stats?.paidThisMonthCount !== 1 ? 's' : ''}`,
      icon: CheckCircle2,
    },
    {
      title: 'Draft Invoices',
      value: statsLoading ? null : String(stats?.draftCount || 0),
      change: 'Ready to issue',
      icon: FileText,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome Section */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your invoices today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRangePreset} onValueChange={(v) => setDateRangePreset(v as DateRangePreset)}>
            <SelectTrigger className="w-[140px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRangePreset === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateFrom ? format(customDateFrom, 'MMM d, yyyy') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateTo ? format(customDateTo, 'MMM d, yyyy') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </>
          )}
          
          <Button variant="outline" size="icon" onClick={refresh} disabled={isRefreshing} title="Refresh dashboard">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link to="/invoices/new">
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Email Verification Warning */}
      {!isEmailVerified && (
        <motion.div variants={item}>
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-700 dark:text-amber-400">Email verification required</p>
                <p className="text-sm text-muted-foreground">
                  Please verify your email to issue invoices. Check your inbox for the verification link.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/verify-email">Verify Now</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stat.value === null ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Revenue Trend Chart */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly revenue over the past 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : revenueTrend && revenueTrend.data.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend.data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value, revenueTrend.currency).replace(/\.00$/, '')} width={80} className="text-muted-foreground" />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value, revenueTrend.currency), 'Revenue']}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <p>No revenue data available yet. Issue some invoices to see your trend!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Due Date Alerts */}
      {(dueDateStats?.overdueCount > 0 || dueDateStats?.upcomingCount > 0) && (
        <motion.div variants={item}>
          <Card className={dueDateStats?.overdueCount > 0 ? "border-destructive/50" : "border-amber-500/50"}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className={`h-5 w-5 ${dueDateStats?.overdueCount > 0 ? 'text-destructive' : 'text-amber-500'}`} />
                Payment Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`p-4 rounded-lg ${dueDateStats?.overdueCount > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">OVERDUE</span>
                    {dueDateStats?.overdueCount > 0 && <Badge variant="destructive" className="text-xs">{dueDateStats.overdueCount}</Badge>}
                  </div>
                  {dueDateLoading ? (
                    <Skeleton className="h-7 w-32" />
                  ) : dueDateStats?.overdueCount > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-destructive">{formatCurrency(dueDateStats.overdueAmount, dueDateStats.currency)}</p>
                      <p className="text-sm text-muted-foreground mt-1">{dueDateStats.overdueCount} invoice{dueDateStats.overdueCount !== 1 ? 's' : ''} past due</p>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <Link to="/invoices?status=overdue">View Overdue</Link>
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No overdue invoices</p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-amber-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">DUE THIS WEEK</span>
                    {dueDateStats?.upcomingCount > 0 && <Badge className="text-xs bg-amber-500">{dueDateStats.upcomingCount}</Badge>}
                  </div>
                  {dueDateLoading ? (
                    <Skeleton className="h-7 w-32" />
                  ) : dueDateStats?.upcomingCount > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-amber-600">{formatCurrency(dueDateStats.upcomingAmount, dueDateStats.currency)}</p>
                      <p className="text-sm text-muted-foreground mt-1">{dueDateStats.upcomingCount} invoice{dueDateStats.upcomingCount !== 1 ? 's' : ''} due soon</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No invoices due this week</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Invoices */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Your latest invoice activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/invoices">View All <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : recentInvoices && recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <Link key={invoice.id} to={`/invoices/${invoice.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No invoices yet</p>
                <Button className="mt-4" asChild>
                  <Link to="/invoices/new">Create your first invoice</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Compliance Footer */}
      <motion.div variants={item}>
        <Card className="bg-muted/30">
          <CardContent className="flex items-center gap-3 py-4">
            <Shield className={`h-5 w-5 ${businessComplianceStatus === 'complete' ? 'text-green-500' : 'text-amber-500'}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {businessComplianceStatus === 'complete' ? 'Compliance Status: Complete' : 'Complete Your Business Profile'}
              </p>
              <p className="text-xs text-muted-foreground">
                {businessComplianceStatus === 'complete' 
                  ? 'Your business profile meets compliance requirements'
                  : 'Add your business details for tax-compliant invoices'}
              </p>
            </div>
            {businessComplianceStatus !== 'complete' && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/business-profile">Complete Profile</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
